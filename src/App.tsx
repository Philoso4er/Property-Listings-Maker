import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { PropertySlide, PanType, MusicTrack, VideoFilter, VideoSettings } from './types';
import { DEFAULT_SLIDES, PAN_OPTIONS, FILTER_OPTIONS, MUSIC_OPTIONS } from './constants';
import { soundscape } from './utils/audio';

export default function App() {
  // 1. App States
  const [slides, setSlides] = useState<PropertySlide[]>(() => {
    // Start with default property slides
    return JSON.parse(JSON.stringify(DEFAULT_SLIDES));
  });
  
  const [selectedSlideId, setSelectedSlideId] = useState<string>('slide_1');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  
  // Global settings
  const [settings, setSettings] = useState<VideoSettings>({
    aspectRatio: '16:9',
    musicTrack: 'luxury_lounge',
    filter: 'none',
    includeBranding: true,
    brandingText: 'Elite Realty Studio',
    captionFont: 'Playfair Display',
    captionAnimation: 'slide_up',
    captionStyle: 'elegant_glass',
  });

  // AI Caption states
  const [loadingCaptions, setLoadingCaptions] = useState<Record<string, boolean>>({});

  // Export states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // HTML Audio playback track state (to handle soundscapes cleanly)
  const [audioActive, setAudioActive] = useState<boolean>(true);

  // New features states: Grid view & Individual Clip Downloads
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [exportingClipId, setExportingClipId] = useState<string | null>(null);
  const [singleExportProgress, setSingleExportProgress] = useState<number>(0);

  // Preset Gallery options to quickly add beautiful rooms
  const presetPool = [
    { name: 'Luxury Sunset Villa', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Modern Penthouse Lounge', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Minimalist Dining Deck', url: 'https://images.unsplash.com/photo-1617806118233-18e1db207f62?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Cozy Fireplace Den', url: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Sleek Master Bath', url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&q=80' },
  ];

  // 2. Refs & Timing Configuration
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const requestRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number | null>(null);

  const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);
  const activeSlide = slides.find((s) => s.id === selectedSlideId) || slides[0];

  // 3. Preload all slide images into memory
  useEffect(() => {
    slides.forEach((slide) => {
      if (!imageCache.current[slide.imageUrl]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = slide.imageUrl;
        img.onload = () => {
          imageCache.current[slide.imageUrl] = img;
          triggerSingleFrame(); // redraw once loaded
        };
      }
    });
  }, [slides]);

  // Preload custom watermark logo if available
  useEffect(() => {
    if (settings.brandingLogoUrl && !imageCache.current[settings.brandingLogoUrl]) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = settings.brandingLogoUrl;
      img.onload = () => {
        imageCache.current[settings.brandingLogoUrl!] = img;
        triggerSingleFrame(); // redraw
      };
      img.onerror = (e) => {
        console.error('Error preloading custom watermark logo:', e);
      };
    }
  }, [settings.brandingLogoUrl]);

  // Redraw when settings or selection changes
  useEffect(() => {
    triggerSingleFrame();
  }, [selectedSlideId, settings, slides, currentTime]);

  // Synchronize soundtrack with play/pause and track settings
  useEffect(() => {
    if (isPlaying && audioActive && settings.musicTrack !== 'none') {
      soundscape.start(settings.musicTrack as any);
    } else {
      soundscape.stop();
    }
    return () => {
      soundscape.stop();
    };
  }, [isPlaying, settings.musicTrack, audioActive]);

  // 4. Playback loop (silky smooth requestAnimationFrame)
  const animate = (timestamp: number) => {
    if (!prevTimeRef.current) prevTimeRef.current = timestamp;
    const delta = (timestamp - prevTimeRef.current) / 1000;
    prevTimeRef.current = timestamp;

    setCurrentTime((prev) => {
      const next = prev + delta;
      if (next >= totalDuration) {
        // Handle Loop
        return 0;
      }
      return next;
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  const handlePlay = () => {
    if (slides.length === 0) return;
    prevTimeRef.current = null;
    setIsPlaying(true);
    requestRef.current = requestAnimationFrame(animate);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  };

  const handleStop = () => {
    handlePause();
    setCurrentTime(0);
  };

  // Skip previous or next slide
  const handlePrevSlide = () => {
    if (slides.length <= 1) return;
    let cumulativeTime = 0;
    let targetTime = 0;
    for (let i = 0; i < slides.length; i++) {
      if (currentTime >= cumulativeTime && currentTime < cumulativeTime + slides[i].duration) {
        // Go to start of this slide, or start of previous slide if already at start of this slide
        const isNearStart = (currentTime - cumulativeTime) < 0.6;
        const prevIndex = isNearStart ? Math.max(0, i - 1) : i;
        
        // Find cumulative start time of the target index
        let checkSum = 0;
        for (let k = 0; k < prevIndex; k++) checkSum += slides[k].duration;
        targetTime = checkSum;
        break;
      }
      cumulativeTime += slides[i].duration;
    }
    setCurrentTime(targetTime);
  };

  const handleNextSlide = () => {
    if (slides.length <= 1) return;
    let cumulativeTime = 0;
    let targetTime = 0;
    for (let i = 0; i < slides.length; i++) {
      if (currentTime >= cumulativeTime && currentTime < cumulativeTime + slides[i].duration) {
        const nextIndex = Math.min(slides.length - 1, i + 1);
        let checkSum = 0;
        for (let k = 0; k < nextIndex; k++) checkSum += slides[k].duration;
        targetTime = checkSum;
        break;
      }
      cumulativeTime += slides[i].duration;
    }
    setCurrentTime(targetTime);
  };

  // Render a single static frame depending on currentTime
  const triggerSingleFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawCanvasScene(canvas, ctx, slides, currentTime, settings, imageCache.current);
  };

  // 5. Drawing core pipeline
  const drawCanvasScene = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    slidesList: PropertySlide[],
    time: number,
    videoSettings: VideoSettings,
    imgCache: Record<string, HTMLImageElement>
  ) => {
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (slidesList.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Drop or add images to begin building property video', width / 2, height / 2);
      return;
    }

    // Find current active slide and offset
    let cumulative = 0;
    let activeIdx = -1;
    let localTime = 0;

    for (let i = 0; i < slidesList.length; i++) {
      const slide = slidesList[i];
      if (time >= cumulative && time < cumulative + slide.duration) {
        activeIdx = i;
        localTime = time - cumulative;
        break;
      }
      cumulative += slide.duration;
    }

    if (activeIdx === -1) {
      activeIdx = slidesList.length - 1;
      let checkSum = 0;
      for (let k = 0; k < activeIdx; k++) checkSum += slidesList[k].duration;
      localTime = Math.max(0, time - checkSum);
    }

    const currentSlide = slidesList[activeIdx];
    const nextSlide = slidesList[activeIdx + 1];

    // Sub-render method for a specific slide with custom pan mechanics
    const renderSlide = (slide: PropertySlide, localProgressTime: number, alpha: number) => {
      const img = imgCache[slide.imageUrl];
      if (!img) {
        // Fallback placeholder during load
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Loading image: ${slide.name}...`, width / 2, height / 2);
        return;
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // Apply filter
      let filterStr = 'none';
      if (videoSettings.filter === 'vintage') filterStr = 'sepia(0.4) contrast(1.1) brightness(0.95)';
      else if (videoSettings.filter === 'warm') filterStr = 'saturate(1.25) sepia(0.12) hue-rotate(-3deg) brightness(0.98)';
      else if (videoSettings.filter === 'cool') filterStr = 'saturate(0.9) contrast(1.05) hue-rotate(8deg) brightness(1.02)';
      else if (videoSettings.filter === 'vibrant') filterStr = 'saturate(1.4) contrast(1.2)';
      else if (videoSettings.filter === 'monochrome') filterStr = 'grayscale(1) contrast(1.3) brightness(0.9)';
      ctx.filter = filterStr;

      // Ensure full cover of the dynamic canvas layout
      const scaleX = width / img.width;
      const scaleY = height / img.height;
      const baseScale = Math.max(scaleX, scaleY);

      // Add pan padding room (1.28x base scale to prevent margins showing during drifts)
      const zoomPadding = 1.28;
      let targetScale = baseScale * zoomPadding;

      let drawW = img.width * targetScale;
      let drawH = img.height * targetScale;
      let maxOffsetX = drawW - width;
      let maxOffsetY = drawH - height;

      let cX = (width - drawW) / 2;
      let cY = (height - drawH) / 2;

      let x = cX;
      let y = cY;

      // Eased progress (easeInOutSine-like curve)
      const p = localProgressTime / slide.duration;
      const easedP = p * p * (3 - 2 * p);

      switch (slide.panType) {
        case 'pan_left_to_right':
          x = -maxOffsetX * easedP;
          break;
        case 'pan_right_to_left':
          x = -maxOffsetX * (1 - easedP);
          break;
        case 'pan_up':
          y = -maxOffsetY * easedP;
          break;
        case 'pan_down':
          y = -maxOffsetY * (1 - easedP);
          break;
        case 'zoom_in': {
          const s = baseScale * (1.05 + 0.23 * easedP);
          drawW = img.width * s;
          drawH = img.height * s;
          x = (width - drawW) / 2;
          y = (height - drawH) / 2;
          break;
        }
        case 'zoom_out': {
          const s = baseScale * (1.28 - 0.23 * easedP);
          drawW = img.width * s;
          drawH = img.height * s;
          x = (width - drawW) / 2;
          y = (height - drawH) / 2;
          break;
        }
        case 'diagonal_drift':
          x = -maxOffsetX * easedP;
          y = -maxOffsetY * (1 - easedP);
          break;
        case 'steady_hold':
        default:
          x = cX;
          y = cY;
          break;
      }

      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.restore();
    };

    // Crossfade windows
    const fadeWindow = 0.8; 
    const timeRemaining = currentSlide.duration - localTime;

    if (timeRemaining < fadeWindow && nextSlide && imgCache[nextSlide.imageUrl]) {
      const ratio = (fadeWindow - timeRemaining) / fadeWindow;
      renderSlide(currentSlide, localTime, 1.0);
      renderSlide(nextSlide, 0, ratio);
    } else {
      renderSlide(currentSlide, localTime, 1.0);
    }

    // Vignette
    const vig = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.45,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // Caption Overlay
    if (currentSlide.caption) {
      const captionFont = videoSettings.captionFont || 'Playfair Display';
      const captionAnimation = videoSettings.captionAnimation || 'slide_up';
      const captionStyle = videoSettings.captionStyle || 'elegant_glass';

      // 1. Resolve Font Declarations
      let fontStr = '600 20px system-ui, -apple-system, sans-serif';
      let isAllCaps = false;

      if (captionFont === 'Playfair Display') {
        fontStr = 'italic 600 20px "Playfair Display", Georgia, serif';
      } else if (captionFont === 'Cinzel') {
        fontStr = '700 17px "Cinzel", serif';
        isAllCaps = true;
      } else if (captionFont === 'Montserrat') {
        fontStr = '900 18px "Montserrat", sans-serif';
        isAllCaps = true;
      } else if (captionFont === 'Space Grotesk') {
        fontStr = '700 19px "Space Grotesk", sans-serif';
      } else if (captionFont === 'Cormorant Garamond') {
        fontStr = 'italic 500 22px "Cormorant Garamond", serif';
      } else if (captionFont === 'JetBrains Mono') {
        fontStr = '500 15px "JetBrains Mono", monospace';
      }

      ctx.save();
      ctx.font = fontStr;

      // Ensure proper text case
      const processedCaption = isAllCaps ? currentSlide.caption.toUpperCase() : currentSlide.caption;
      const words = processedCaption.split(' ');
      let line = '';
      const lines: string[] = [];
      const maxW = width - 140;

      // Wrapping text based on font size & canvas width
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxW && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      // 2. Compute Entry Animations
      const animDuration = 0.8;
      let animAlpha = 1.0;
      let animYOffset = 0;
      let animScale = 1.0;
      let linesToDraw = lines;

      if (captionAnimation === 'fade_in') {
        if (localTime < animDuration) {
          animAlpha = localTime / animDuration;
        }
      } else if (captionAnimation === 'slide_up') {
        if (localTime < animDuration) {
          const ratio = localTime / animDuration;
          animAlpha = ratio;
          animYOffset = 25 * (1 - ratio * ratio * (3 - 2 * ratio));
        }
      } else if (captionAnimation === 'zoom') {
        if (localTime < animDuration) {
          const ratio = localTime / animDuration;
          animScale = 0.92 + 0.08 * ratio;
          animAlpha = ratio;
        }
      } else if (captionAnimation === 'typewriter') {
        const charsPerSec = 35;
        const totalBudget = Math.floor(localTime * charsPerSec);
        let cumulativeChars = 0;
        const typewriterLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          if (cumulativeChars >= totalBudget) {
            break;
          }
          if (cumulativeChars + lineText.length <= totalBudget) {
            typewriterLines.push(lineText);
            cumulativeChars += lineText.length + 1;
          } else {
            const partLength = totalBudget - cumulativeChars;
            typewriterLines.push(lineText.slice(0, partLength));
            cumulativeChars += partLength;
            break;
          }
        }
        linesToDraw = typewriterLines;
      }

      // 3. Render Design Backing Plate
      const spacing = captionFont === 'JetBrains Mono' ? 24 : 28;
      const textBlockH = linesToDraw.length * spacing;

      if (captionStyle === 'elegant_glass') {
        let maxLineWidth = 0;
        for (const l of linesToDraw) {
          const w = ctx.measureText(l).width;
          if (w > maxLineWidth) maxLineWidth = w;
        }
        const boxPaddingH = 32;
        const boxPaddingV = 18;
        const boxW = Math.min(width - 80, maxLineWidth + boxPaddingH * 2);
        const boxH = textBlockH + boxPaddingV * 2;
        const boxX = (width - boxW) / 2;
        const boxY = height - 50 - boxH;

        ctx.save();
        ctx.globalAlpha = animAlpha;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(boxX, boxY, boxW, boxH, 12);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (captionStyle === 'minimal_dark') {
        const stripH = 135;
        ctx.save();
        ctx.globalAlpha = animAlpha;
        ctx.fillStyle = 'rgba(9, 11, 15, 0.92)';
        ctx.fillRect(0, height - stripH, width, stripH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height - stripH);
        ctx.lineTo(width, height - stripH);
        ctx.stroke();
        ctx.restore();
      } else if (captionStyle === 'classic_serif') {
        const gradH = 140;
        ctx.save();
        ctx.globalAlpha = animAlpha;
        const textGrad = ctx.createLinearGradient(0, height - gradH, 0, height);
        textGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        textGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = textGrad;
        ctx.fillRect(0, height - gradH, width, gradH);

        const startY = height - 60 - textBlockH / 2;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 80, startY - 14);
        ctx.lineTo(width / 2 + 80, startY - 14);
        ctx.stroke();
        ctx.restore();
      } else if (captionStyle === 'bold_banner') {
        const bannerW = Math.round(width * 0.76);
        const bannerH = textBlockH + 36;
        const bannerY = height - bannerH - 40;

        ctx.save();
        ctx.globalAlpha = animAlpha;
        ctx.fillStyle = 'rgba(79, 70, 229, 0.92)';
        ctx.fillRect(0, bannerY, bannerW, bannerH);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, bannerY, 6, bannerH);
        ctx.restore();
      } else {
        // clean_caption
        const rectH = 120;
        ctx.save();
        ctx.globalAlpha = animAlpha;
        const textGrad = ctx.createLinearGradient(0, height - rectH, 0, height);
        textGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        textGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.55)');
        textGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
        ctx.fillStyle = textGrad;
        ctx.fillRect(0, height - rectH, width, rectH);
        ctx.restore();
      }

      // 4. Draw Typography lines
      ctx.save();
      ctx.globalAlpha = animAlpha;

      const isLeftAlign = captionStyle === 'bold_banner';
      ctx.textAlign = isLeftAlign ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = captionStyle === 'classic_serif' ? 12 : 6;
      ctx.shadowOffsetY = 2;

      let startY = height - 55 - (textBlockH / 2) + animYOffset;
      let drawX = width / 2;

      if (captionStyle === 'bold_banner') {
        const bannerH = textBlockH + 36;
        const bannerY = height - bannerH - 40;
        startY = bannerY + 18 + (spacing / 2) + animYOffset;
        drawX = 30;
      } else if (captionStyle === 'elegant_glass') {
        const boxPaddingV = 18;
        const boxH = textBlockH + boxPaddingV * 2;
        const boxY = height - 50 - boxH;
        startY = boxY + boxPaddingV + (spacing / 2) + animYOffset;
      }

      if (captionAnimation === 'zoom' && animScale !== 1.0) {
        const centerX = isLeftAlign ? width * 0.38 : width / 2;
        const centerY = startY + textBlockH / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(animScale, animScale);
        ctx.translate(-centerX, -centerY);
      }

      for (let k = 0; k < linesToDraw.length; k++) {
        ctx.fillText(linesToDraw[k], drawX, startY + k * spacing);
      }

      ctx.restore();
      ctx.restore(); // for general save
    }

    // Branding / Agency badge
    if (videoSettings.includeBranding) {
      const logoImg = videoSettings.brandingLogoUrl ? imgCache[videoSettings.brandingLogoUrl] : null;
      if (logoImg) {
        ctx.save();
        // Maintain aspect ratio, max height 36px, max width 140px
        const maxH = 36;
        const maxW = 140;
        let logoW = logoImg.width;
        let logoH = logoImg.height;
        const ratio = Math.min(maxW / logoW, maxH / logoH);
        logoW = logoW * ratio;
        logoH = logoH * ratio;

        const badgeW = logoW + 20;
        const badgeH = logoH + 16;
        
        // Draw elegant glassy bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(width - badgeW - 24, 24, badgeW, badgeH);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(width - badgeW - 24, 24, badgeW, badgeH);

        // Center logo in the badge
        try {
          ctx.drawImage(logoImg, width - badgeW - 24 + 10, 24 + 8, logoW, logoH);
        } catch (e) {
          console.error('Failed to draw custom logo image:', e);
        }
        ctx.restore();
      } else if (videoSettings.brandingText) {
        ctx.save();
        const brandStr = videoSettings.brandingText.toUpperCase();
        ctx.font = 'bold 13px system-ui, sans-serif';
        const textW = ctx.measureText(brandStr).width;
        
        const badgeW = textW + 20;
        const badgeH = 30;

        // Draw elegant glassy bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(width - badgeW - 24, 24, badgeW, badgeH);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(width - badgeW - 24, 24, badgeW, badgeH);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brandStr, width - (badgeW / 2) - 24, 24 + (badgeH / 2));
        ctx.restore();
      }
    }
  };

  // 6. Real-Time Offline Canvas Recording & Stitcher Exporter
  const handleExportVideo = async () => {
    if (slides.length === 0) return;
    handlePause();
    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    // Setup Canvas dimension based on selected layout
    let exportW = 1280;
    let exportH = 720;
    if (settings.aspectRatio === '9:16') {
      exportW = 720;
      exportH = 1280;
    } else if (settings.aspectRatio === '1:1') {
      exportW = 1000;
      exportH = 1000;
    }

    try {
      // Create hidden offscreen canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportW;
      exportCanvas.height = exportH;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('Could not create standard 2D context.');

      // Capture canvas video stream
      const stream = exportCanvas.captureStream(30); // 30 FPS
      
      // Determine mimetype support in current browser (WebM is widely supported natively)
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: '' }; // Fallback
      }

      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const downloadUrl = URL.createObjectURL(videoBlob);
        
        // Auto download trigger
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `property_cinematic_${settings.aspectRatio.replace(':', '_')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setIsExporting(false);
        setExportProgress(100);
      };

      // Start recording
      recorder.start();

      const fps = 30;
      const totalFrames = Math.floor(totalDuration * fps);
      let currentFrame = 0;

      const renderNextExportFrame = () => {
        if (currentFrame > totalFrames) {
          recorder.stop();
          return;
        }

        const virtualTime = currentFrame / fps;
        drawCanvasScene(exportCanvas, exportCtx, slides, virtualTime, settings, imageCache.current);
        
        setExportProgress(Math.floor((currentFrame / totalFrames) * 100));
        currentFrame++;

        // Render continuously with quick setTimeouts to keep it asynchronous and responsive without blocking UI thread
        setTimeout(renderNextExportFrame, 16); 
      };

      // Start the frame-by-frame renderer
      renderNextExportFrame();

    } catch (err: any) {
      console.error(err);
      setExportError(err.message || 'The browser blocked creating a MediaRecorder on canvas stream.');
      setIsExporting(false);
    }
  };

  // 6.2. Export a single clip as an independent movie
  const handleExportSingleClip = async (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;

    handlePause();
    setExportingClipId(slideId);
    setSingleExportProgress(0);

    // Setup Canvas dimension based on selected layout
    let exportW = 1280;
    let exportH = 720;
    if (settings.aspectRatio === '9:16') {
      exportW = 720;
      exportH = 1280;
    } else if (settings.aspectRatio === '1:1') {
      exportW = 1000;
      exportH = 1000;
    }

    try {
      // Create hidden offscreen canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportW;
      exportCanvas.height = exportH;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('Could not create standard 2D context.');

      // Capture canvas video stream
      const stream = exportCanvas.captureStream(30); // 30 FPS
      
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: '' }; // Fallback
      }

      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const downloadUrl = URL.createObjectURL(videoBlob);
        
        // Auto download trigger
        const a = document.createElement('a');
        a.href = downloadUrl;
        const sanitizedName = slide.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        a.download = `clip_${sanitizedName}_${settings.aspectRatio.replace(':', '_')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setExportingClipId(null);
        setSingleExportProgress(100);
      };

      // Start recording
      recorder.start();

      const fps = 30;
      const totalFrames = Math.floor(slide.duration * fps);
      let currentFrame = 0;

      const renderNextExportFrame = () => {
        if (currentFrame > totalFrames) {
          recorder.stop();
          return;
        }

        const virtualTime = currentFrame / fps;
        // Pass ONLY this single slide to render it as an independent clip
        drawCanvasScene(exportCanvas, exportCtx, [slide], virtualTime, settings, imageCache.current);
        
        setSingleExportProgress(Math.floor((currentFrame / totalFrames) * 100));
        currentFrame++;

        setTimeout(renderNextExportFrame, 16); 
      };

      renderNextExportFrame();

    } catch (err: any) {
      console.error(err);
      alert(err.message || 'The browser blocked creating a MediaRecorder on canvas stream.');
      setExportingClipId(null);
    }
  };

  // 7. Interactive playlist manipulators
  const getBase64FromImageUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => {
        reject(err);
      };
    });
  };

  const handleAutoGenerateCaption = async (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;

    setLoadingCaptions((prev) => ({ ...prev, [slideId]: true }));

    try {
      let body: any = {};
      
      if (slide.imageUrl.startsWith('blob:')) {
        try {
          const base64 = await getBase64FromImageUrl(slide.imageUrl);
          body.base64Image = base64;
        } catch (blobErr) {
          console.error('Error converting blob to base64:', blobErr);
          throw blobErr;
        }
      } else {
        body.imageUrl = slide.imageUrl;
      }

      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          userGuidance: settings.aiGuidance,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSlides((prev) =>
          prev.map((s) =>
            s.id === slideId
              ? {
                  ...s,
                  caption: data.caption || s.caption,
                  name: data.name || s.name,
                  panType: (data.panType as any) || s.panType,
                }
              : s
          )
        );
      } else {
        const errData = await response.json();
        console.error('API Error auto-captioning:', errData.error);
      }
    } catch (err) {
      console.error('Error auto-captioning slide:', err);
    } finally {
      setLoadingCaptions((prev) => ({ ...prev, [slideId]: false }));
    }
  };

  const handleAddCustomSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const newId = `slide_${Date.now()}`;
    const newSlide: PropertySlide = {
      id: newId,
      imageUrl: fileUrl,
      name: file.name.split('.')[0].replace(/[-_]/g, ' ') || 'New Property Picture',
      panType: 'zoom_in',
      duration: 5,
      caption: 'AI is analyzing listing photo to generate a caption...',
    };

    setSlides((prev) => [...prev, newSlide]);
    setSelectedSlideId(newId);

    // Read file as Base64 and trigger generate-caption API!
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      setLoadingCaptions((prev) => ({ ...prev, [newId]: true }));
      try {
        const response = await fetch('/api/generate-caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Image,
            userGuidance: settings.aiGuidance,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setSlides((prev) =>
            prev.map((s) =>
              s.id === newId
                ? {
                    ...s,
                    caption: data.caption || s.caption,
                    name: data.name || s.name,
                    panType: (data.panType as any) || s.panType,
                  }
                : s
            )
          );
        } else {
          setSlides((prev) =>
            prev.map((s) =>
              s.id === newId
                ? {
                    ...s,
                    caption: 'Luxurious view showcasing exquisite architectural design.',
                  }
                : s
            )
          );
        }
      } catch (err) {
        console.error('Error auto generating caption for uploaded file:', err);
      } finally {
        setLoadingCaptions((prev) => ({ ...prev, [newId]: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddPresetSlide = (name: string, url: string) => {
    const newId = `slide_${Date.now()}`;
    const newSlide: PropertySlide = {
      id: newId,
      imageUrl: url,
      name,
      panType: 'zoom_in',
      duration: 5,
      caption: 'AI is analyzing preset photo to generate a caption...',
    };

    setSlides((prev) => [...prev, newSlide]);
    setSelectedSlideId(newId);

    // Trigger auto generation
    handleAutoGenerateCaption(newId);
  };

  const handleRemoveSlide = (id: string) => {
    if (slides.length <= 1) return; // Keep at least 1 slide
    const filtered = slides.filter((s) => s.id !== id);
    setSlides(filtered);
    if (selectedSlideId === id) {
      setSelectedSlideId(filtered[0].id);
    }
    setCurrentTime(0);
  };

  const handleUpdateSlideDetails = (id: string, updates: Partial<PropertySlide>) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const copy = [...slides];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    
    setSlides(copy);
    setCurrentTime(0);
  };

  // Format seconds to 0:00 format
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  // Determine current active slide in real-time to highlight in sidebar
  const getActiveSlideIndexInTimeline = () => {
    let sum = 0;
    for (let i = 0; i < slides.length; i++) {
      if (currentTime >= sum && currentTime < sum + slides[i].duration) {
        return i;
      }
      sum += slides[i].duration;
    }
    return slides.length - 1;
  };

  const currentTimelineIndex = getActiveSlideIndexInTimeline();

  // Handle timeline slider drag change
  const handleTimelineScrub = (val: number) => {
    setCurrentTime(val);
    triggerSingleFrame();
  };

  // Canvas aspect ratio CSS wrapper dimensions
  const getCanvasWrapperStyles = () => {
    if (settings.aspectRatio === '9:16') {
      return { aspectRatio: '9/16', maxHeight: '550px' };
    } else if (settings.aspectRatio === '1:1') {
      return { aspectRatio: '1/1', maxHeight: '460px' };
    }
    return { aspectRatio: '16/9', maxHeight: '400px' };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* 1. TOP HEADER BRANDING BAR */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/10">
            <Lucide.Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-wider text-slate-100">
              AURA CINEMATIC
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-indigo-400 font-bold uppercase">
              Property Image-to-Video Studio
            </p>
          </div>
        </div>

        {/* Action badges */}
        <div className="flex items-center gap-3">
          {totalDuration > 0 && (
            <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Total Video Length: <b className="text-slate-200">{formatTime(totalDuration)}s</b></span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setAudioActive(!audioActive)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              audioActive 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Synthesizer Soundtrack Audibility"
          >
            {audioActive ? <Lucide.Volume2 className="w-3.5 h-3.5" /> : <Lucide.VolumeX className="w-3.5 h-3.5" />}
            <span>{audioActive ? 'Synthesizer Active' : 'Sound Muted'}</span>
          </button>
        </div>
      </header>

      {/* 2. DYNAMIC WORKSPACE GRID */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start overflow-hidden">
        
        {/* ================= LEFT COLUMN: SLIDES PLAYLIST (3/12) ================= */}
        <section className="lg:col-span-3 flex flex-col gap-5 h-[calc(100vh-140px)] overflow-y-auto pr-1">
          
          {/* Upload and quick presets pane */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <Lucide.FileImage className="w-4 h-4 text-indigo-400" />
              1. INPUT LISTING IMAGES
            </h2>

            {/* Local Image Uploader */}
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-800 hover:border-indigo-500/70 bg-slate-950/40 hover:bg-indigo-500/5 transition-all rounded-xl p-4 text-center cursor-pointer group">
              <Lucide.UploadCloud className="w-7 h-7 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              <div className="text-xs font-bold text-slate-300">Upload Property Photograph</div>
              <div className="text-[10px] text-slate-500 font-mono">JPG, PNG or WEBP formats</div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAddCustomSlide}
                className="hidden"
              />
            </label>

            {/* Quick-add Premium Presets */}
            <div className="border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-wider">
                Or Quick-Add Demo Property Rooms
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {presetPool.map((room, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAddPresetSlide(room.name, room.url)}
                    className="p-1 text-[10px] bg-slate-950/50 border border-slate-800 hover:border-indigo-500 rounded-lg text-left text-slate-400 hover:text-white transition-all truncate flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="truncate">{room.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slides Timeline order list */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-xl flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <Lucide.ListVideo className="w-4 h-4 text-indigo-400" />
                2. CLIPS SEQUENCE
              </h2>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-850">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                  title="List View"
                >
                  <Lucide.List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                  title="Grid View"
                >
                  <Lucide.Grid3X3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px] pr-1">
                {slides.map((slide, index) => {
                  const isActiveInPreview = selectedSlideId === slide.id;
                  const isPlayingRightNow = isPlaying && currentTimelineIndex === index;
                  
                  return (
                    <div
                      key={slide.id}
                      onClick={() => {
                        setSelectedSlideId(slide.id);
                        // Jump playhead to beginning of this slide
                        let checkSum = 0;
                        for (let k = 0; k < index; k++) checkSum += slides[k].duration;
                        setCurrentTime(checkSum);
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex gap-3 relative overflow-hidden group ${
                        isActiveInPreview
                          ? 'border-indigo-500 bg-indigo-500/5'
                          : 'border-slate-850 bg-slate-950/40 hover:bg-slate-900/40'
                      }`}
                    >
                      {/* Active playing pulse bar */}
                      {isPlayingRightNow && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 animate-pulse" />
                      )}

                      {loadingCaptions[slide.id] && (
                        <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-1 z-10 backdrop-blur-[1px]">
                          <div className="flex items-center gap-1 text-indigo-450 font-bold text-[9px] font-mono tracking-wider animate-pulse">
                            <Lucide.Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>AI CAPTIONING...</span>
                          </div>
                        </div>
                      )}

                      <div className="w-14 h-14 rounded-lg border border-slate-800 overflow-hidden bg-slate-900 shrink-0 relative">
                        <img
                          src={slide.imageUrl}
                          alt={slide.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-0 right-0 bg-slate-950/80 px-1 text-[8px] font-mono text-slate-300 font-bold rounded-tl">
                          {slide.duration}s
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-200 truncate group-hover:text-white">
                              {slide.name}
                            </div>
                            <div className="text-[9px] font-mono text-slate-500 mt-0.5 truncate uppercase">
                              {PAN_OPTIONS.find((p) => p.value === slide.panType)?.label || 'No Motion'}
                            </div>
                          </div>

                          {/* Delete slide icon positioned at the top right of the info for easier navigation */}
                          {slides.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSlide(slide.id);
                              }}
                              className="p-1 rounded text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 shrink-0 self-start"
                              title="Delete Slide"
                            >
                              <Lucide.Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Control buttons for moving up/down or downloading */}
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40">
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={index === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSlide(index, 'up');
                              }}
                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-20"
                              title="Move Up"
                            >
                              <Lucide.ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={index === slides.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSlide(index, 'down');
                              }}
                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-20"
                              title="Move Down"
                            >
                              <Lucide.ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Individual clip download button */}
                          <button
                            type="button"
                            disabled={exportingClipId !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportSingleClip(slide.id);
                            }}
                            className={`p-1 px-1.5 rounded text-[10px] transition-colors font-semibold flex items-center gap-1 shrink-0 ${
                              exportingClipId === slide.id
                                ? 'text-indigo-400 bg-indigo-500/10'
                                : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                            }`}
                            title="Download Single Clip Video"
                          >
                            {exportingClipId === slide.id ? (
                              <>
                                <Lucide.Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                <span>{singleExportProgress}%</span>
                              </>
                            ) : (
                              <>
                                <Lucide.Download className="w-3 h-3" />
                                <span>Clip</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Grid view of clips sequence */
              <div className="grid grid-cols-2 gap-2.5 overflow-y-auto max-h-[420px] pr-1">
                {slides.map((slide, index) => {
                  const isActiveInPreview = selectedSlideId === slide.id;
                  const isPlayingRightNow = isPlaying && currentTimelineIndex === index;
                  
                  return (
                    <div
                      key={slide.id}
                      onClick={() => {
                        setSelectedSlideId(slide.id);
                        // Jump playhead to beginning of this slide
                        let checkSum = 0;
                        for (let k = 0; k < index; k++) checkSum += slides[k].duration;
                        setCurrentTime(checkSum);
                      }}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden group ${
                        isActiveInPreview
                          ? 'border-indigo-500 bg-indigo-500/5'
                          : 'border-slate-850 bg-slate-950/40 hover:bg-slate-900/40'
                      }`}
                    >
                      {/* Active playing pulse bar */}
                      {isPlayingRightNow && (
                        <div className="absolute left-0 right-0 top-0 h-1 bg-emerald-400 animate-pulse" />
                      )}

                      {loadingCaptions[slide.id] && (
                        <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-1 z-10 backdrop-blur-[1px]">
                          <div className="flex items-center gap-1 text-indigo-450 font-bold text-[9px] font-mono tracking-wider animate-pulse">
                            <Lucide.Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>AI CAPTIONING...</span>
                          </div>
                        </div>
                      )}

                      {/* Thumbnail section */}
                      <div className="w-full aspect-[4/3] rounded-lg border border-slate-800 overflow-hidden bg-slate-900 relative shrink-0">
                        <img
                          src={slide.imageUrl}
                          alt={slide.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-1 right-1 bg-slate-950/85 px-1 py-0.5 text-[8px] font-mono text-slate-300 font-bold rounded">
                          {slide.duration}s
                        </span>

                        {/* Delete button positioned at the top right of the thumbnail for easier navigation */}
                        {slides.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSlide(slide.id);
                            }}
                            className="absolute top-1 right-1 p-1 bg-slate-950/80 hover:bg-rose-950/95 text-rose-500 hover:text-rose-400 rounded-md border border-slate-800/60 shadow transition-colors z-20"
                            title="Delete Slide"
                          >
                            <Lucide.Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Text details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="truncate">
                          <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-white">
                            {slide.name}
                          </div>
                          <div className="text-[8px] font-mono text-slate-500 mt-0.5 truncate uppercase">
                            {PAN_OPTIONS.find((p) => p.value === slide.panType)?.label || 'No Motion'}
                          </div>
                        </div>

                        {/* Actions at bottom */}
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40">
                          <div className="flex items-center gap-1">
                            <button
                              disabled={index === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSlide(index, 'up');
                              }}
                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-20"
                              title="Move Up"
                            >
                              <Lucide.ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={index === slides.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSlide(index, 'down');
                              }}
                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-20"
                              title="Move Down"
                            >
                              <Lucide.ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Individual clip download button */}
                          <button
                            type="button"
                            disabled={exportingClipId !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportSingleClip(slide.id);
                            }}
                            className={`p-1 px-1.5 rounded text-[10px] transition-colors font-semibold flex items-center gap-1 shrink-0 ${
                              exportingClipId === slide.id
                                ? 'text-indigo-400 bg-indigo-500/10'
                                : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                            }`}
                            title="Download Single Clip Video"
                          >
                            {exportingClipId === slide.id ? (
                              <>
                                <Lucide.Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                                <span>{singleExportProgress}%</span>
                              </>
                            ) : (
                              <>
                                <Lucide.Download className="w-3 h-3" />
                                <span>Clip</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ================= CENTER COLUMN: VIDEO CANVAS PLAYER (6/12) ================= */}
        <section className="lg:col-span-6 flex flex-col gap-5 items-center justify-center">
          
          {/* Main Visual Cinematic Canvas Box */}
          <div className="w-full bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center shadow-2xl relative overflow-hidden min-h-[500px]">
            
            {/* Title display header inside canvas box */}
            <div className="w-full flex items-center justify-between mb-4 pb-2.5 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-bold uppercase font-mono tracking-wider">
                  Live HD Playback
                </span>
                <span className="text-xs font-semibold text-slate-400 truncate">
                  {activeSlide ? activeSlide.name : 'No Slide Active'}
                </span>
              </div>

              {/* Aspect Ratio Display badge */}
              <div className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                Aspect ratio: {settings.aspectRatio}
              </div>
            </div>

            {/* Canvas Aspect-ratio Frame Container */}
            <div 
              style={getCanvasWrapperStyles()}
              className="w-full bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-center shadow-inner relative overflow-hidden transition-all duration-300"
            >
              {/* Actual HTML5 Rendering Canvas */}
              <canvas
                ref={canvasRef}
                width={settings.aspectRatio === '9:16' ? 576 : settings.aspectRatio === '1:1' ? 600 : 800}
                height={settings.aspectRatio === '9:16' ? 1024 : settings.aspectRatio === '1:1' ? 600 : 450}
                className="w-full h-full object-contain"
              />

              {/* Loading indicator when rendering */}
              {isExporting && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm z-40">
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
                    <Lucide.Sparkles className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
                  </div>
                  <h3 className="text-md font-bold text-slate-100 tracking-wide">
                    STITCHING MOVIE CLIPS TOGETHER
                  </h3>
                  <p className="text-xs text-indigo-400 font-mono mt-1 uppercase font-bold tracking-widest">
                    Export Progress: {exportProgress}%
                  </p>
                  
                  {/* High precision loading status details */}
                  <div className="w-56 bg-slate-900 border border-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                    <div 
                      style={{ width: `${exportProgress}%` }}
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 h-full transition-all duration-150"
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 max-w-xs mt-3">
                    We are compiling and panning your static frames frame-by-frame with high-fidelity vintage rendering into video clips. Please keep AI Studio tab open.
                  </p>
                </div>
              )}
            </div>

            {/* Scrubbable Range Timeline Playhead Slider */}
            <div className="w-full mt-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Current playhead: <b>{formatTime(currentTime)}s</b></span>
                <span>Total length: <b>{formatTime(totalDuration)}s</b></span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, totalDuration)}
                step={0.05}
                value={currentTime}
                onChange={(e) => handleTimelineScrub(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Direct Media Action Buttons */}
            <div className="flex items-center gap-4 mt-4 w-full justify-between">
              
              {/* Secondary Reset / Zero Button */}
              <button
                onClick={handleStop}
                className="p-2 rounded-lg bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all text-xs flex items-center gap-1.5"
                title="Rewind Timeline to Zero"
              >
                <Lucide.RotateCcw className="w-4 h-4" />
                <span>Rewind</span>
              </button>

              {/* Core Play controls */}
              <div className="flex items-center bg-slate-950 rounded-xl border border-slate-850 p-1 shadow-md">
                <button
                  onClick={handlePrevSlide}
                  className="p-2 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-all"
                  title="Previous Slide"
                >
                  <Lucide.ArrowLeft className="w-4 h-4" />
                </button>

                {isPlaying ? (
                  <button
                    onClick={handlePause}
                    className="mx-1 px-5 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Lucide.Pause className="w-4 h-4" />
                    <span>PAUSE PREVIEW</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    className="mx-1 px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/10"
                  >
                    <Lucide.Play className="w-4 h-4" />
                    <span>PLAY PREVIEW</span>
                  </button>
                )}

                <button
                  onClick={handleNextSlide}
                  className="p-2 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-all"
                  title="Next Slide"
                >
                  <Lucide.ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Info banner about WebM format */}
              <div className="text-[10px] text-slate-500 font-mono hidden md:block max-w-[150px] text-right">
                Press Play to view real-time cinematic drifts.
              </div>
            </div>
          </div>
        </section>

        {/* ================= RIGHT COLUMN: EXPORT & CAMERA CONFIG (3/12) ================= */}
        <section className="lg:col-span-3 flex flex-col gap-5 h-[calc(100vh-140px)] overflow-y-auto pl-1">
          
          {/* Active slide camera pan customized editor */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between gap-1.5">
              <h2 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <Lucide.Edit3 className="w-4 h-4 text-indigo-400" />
                3. CAM CONFIG
              </h2>
              {activeSlide && slides.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSlide(activeSlide.id)}
                  className="p-1 px-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-350 text-[9px] font-bold flex items-center gap-1 transition-all"
                  title="Delete Currently Selected Slide"
                >
                  <Lucide.Trash2 className="w-3 h-3" />
                  <span>DELETE CLIP</span>
                </button>
              )}
            </div>

            {activeSlide ? (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-slate-400">
                  Configure camera movement for selected clip: <b className="text-slate-200">"{activeSlide.name}"</b>
                </div>

                {/* Edit Slide Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">CLIP TITLE</label>
                  <input
                    type="text"
                    value={activeSlide.name}
                    onChange={(e) => handleUpdateSlideDetails(activeSlide.id, { name: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Select Pan Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">CAMERA PAN DIRECTION</label>
                  <select
                    value={activeSlide.panType}
                    onChange={(e) => handleUpdateSlideDetails(activeSlide.id, { panType: e.target.value as PanType })}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors font-medium text-slate-300"
                  >
                    {PAN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Edit Duration Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">CLIP DURATION</label>
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">{activeSlide.duration} seconds</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    step={1}
                    value={activeSlide.duration}
                    onChange={(e) => handleUpdateSlideDetails(activeSlide.id, { duration: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Edit Caption commentary overlay text */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">CAPTION COMMENTARY TEXT</label>
                    <button
                      onClick={() => handleAutoGenerateCaption(activeSlide.id)}
                      disabled={loadingCaptions[activeSlide.id]}
                      className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                      title="Automatically analyze image with Gemini to generate caption, name, and best camera pan."
                    >
                      {loadingCaptions[activeSlide.id] ? (
                        <>
                          <Lucide.Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                          <span>ANALYZING...</span>
                        </>
                      ) : (
                        <>
                          <Lucide.Sparkles className="w-2.5 h-2.5" />
                          <span>AI AUTO-CAPTION</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={activeSlide.caption}
                    onChange={(e) => handleUpdateSlideDetails(activeSlide.id, { caption: e.target.value })}
                    placeholder="Describe listing highlights..."
                    rows={3}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none font-medium text-slate-300"
                  />
                </div>

                {/* Download Individual Clip Button */}
                <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-1.5 mt-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">INDIVIDUAL EXPORT</label>
                  <button
                    type="button"
                    disabled={exportingClipId !== null}
                    onClick={() => handleExportSingleClip(activeSlide.id)}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-55"
                  >
                    {exportingClipId === activeSlide.id ? (
                      <>
                        <Lucide.Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>EXPORTING CLIP ({singleExportProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <Lucide.Download className="w-4 h-4" />
                        <span>DOWNLOAD THIS CLIP ONLY</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-4 text-center">
                Select a clip from the playlist sequence to customize its camera pan directions.
              </div>
            )}
          </div>

          {/* AI Auto-Caption Guidelines */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <Lucide.Sparkles className="w-4 h-4 text-indigo-400" />
              AI CAPTION GUIDELINES
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase">LONG-FORM PROPERTY DESCRIPTION & TONE</label>
              <span className="text-[8px] font-mono text-slate-500">PASTE LISTING TEXT OR DESIRED STYLE GUIDELINES TO DIRECT AI CAPTIONING</span>
              <textarea
                value={settings.aiGuidance || ''}
                onChange={(e) => setSettings({ ...settings, aiGuidance: e.target.value })}
                placeholder="e.g. This is a $3.5M high-end penthouse. Style needs to be modern, dramatic, and evoke exclusivity. Mention premium French oak flooring and floor-to-ceiling windows when relevant."
                rows={4}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none font-medium leading-relaxed"
              />
              {activeSlide && (
                <button
                  type="button"
                  onClick={() => handleAutoGenerateCaption(activeSlide.id)}
                  disabled={loadingCaptions[activeSlide.id]}
                  className="w-full mt-1.5 py-1.5 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {loadingCaptions[activeSlide.id] ? (
                    <>
                      <Lucide.Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      <span>GENERATING WITH NEW RULES...</span>
                    </>
                  ) : (
                    <>
                      <Lucide.Sparkles className="w-3 h-3" />
                      <span>APPLY GUIDELINES TO CURRENT CLIP</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* CAPTION MOTION & DESIGN */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <Lucide.Type className="w-4 h-4 text-indigo-400" />
              CAPTION MOTION & DESIGN
            </h2>
            
            {/* Font Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">CUSTOM TEXT FONT</label>
              <select
                value={settings.captionFont || 'Playfair Display'}
                onChange={(e) => setSettings({ ...settings, captionFont: e.target.value as any })}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors font-medium text-slate-300"
              >
                <option value="Playfair Display">Playfair Display (Luxury Serif)</option>
                <option value="Cinzel">Cinzel (Classical Roman Serif)</option>
                <option value="Montserrat">Montserrat (Modern Avant-Garde)</option>
                <option value="Space Grotesk">Space Grotesk (Tech Minimalist)</option>
                <option value="Cormorant Garamond">Cormorant Garamond (High-End Literary)</option>
                <option value="JetBrains Mono">JetBrains Mono (Cinematic Code)</option>
                <option value="system-ui">System UI (Standard Clean)</option>
              </select>
            </div>

            {/* Design Style */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">OVERLAY DESIGN STYLE</label>
              <select
                value={settings.captionStyle || 'elegant_glass'}
                onChange={(e) => setSettings({ ...settings, captionStyle: e.target.value as any })}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors font-medium text-slate-300"
              >
                <option value="elegant_glass">Elegant Glass Box ( frosted / premium )</option>
                <option value="minimal_dark">Cinematic Letterbox ( deep solid strip )</option>
                <option value="classic_serif">Classic Serif ( golden divider accents )</option>
                <option value="bold_banner">Bold Indigo Banner ( asymmetric modern )</option>
                <option value="clean_caption">Clean Drop-Shadow ( seamless transparent )</option>
              </select>
            </div>

            {/* Text Entrance Animation */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">TEXT ENTRANCE MOTION FX</label>
              <select
                value={settings.captionAnimation || 'slide_up'}
                onChange={(e) => setSettings({ ...settings, captionAnimation: e.target.value as any })}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors font-medium text-slate-300"
              >
                <option value="slide_up">Slide Up & Fade ( Cinematic Lift )</option>
                <option value="fade_in">Ambient Soft Fade ( Smooth Glow )</option>
                <option value="typewriter">Typewriter Effect ( Word-by-Word Kinetic )</option>
                <option value="zoom">Dynamic Scale In ( Camera Drift Zoom )</option>
                <option value="none">No Motion ( Static Display )</option>
              </select>
            </div>
          </div>

          {/* Global rendering & Export Settings */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <Lucide.Settings className="w-4 h-4 text-indigo-400" />
              4. CINEMATIC EXPORT ARTIFACTS
            </h2>

            {/* Layout Aspect Ratio Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">VIDEO DIMENSION RATIO</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: '16:9', label: 'Landscape 16:9', sub: 'YouTube / TV' },
                  { value: '9:16', label: 'Portrait 9:16', sub: 'Reels / TikTok' },
                  { value: '1:1', label: 'Square 1:1', sub: 'Instagram' },
                ].map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setSettings({ ...settings, aspectRatio: ratio.value as any })}
                    className={`p-1.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      settings.aspectRatio === ratio.value
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-bold">{ratio.value}</span>
                    <span className="text-[7px] font-mono text-slate-500 tracking-wide mt-0.5">{ratio.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Select Ambient Music Track */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">AMBIENT SYNTH SOUNDTRACK</label>
              <select
                value={settings.musicTrack}
                onChange={(e) => setSettings({ ...settings, musicTrack: e.target.value as MusicTrack })}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              >
                {MUSIC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Instagram / Classic Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">VINTAGE COLOR GRADING</label>
              <select
                value={settings.filter}
                onChange={(e) => setSettings({ ...settings, filter: e.target.value as VideoFilter })}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle Watermark Agency Brand */}
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-slate-500 uppercase">OVERLAY BRAND WATERMARK</label>
                <input
                  type="checkbox"
                  checked={settings.includeBranding}
                  onChange={(e) => setSettings({ ...settings, includeBranding: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer rounded bg-slate-950 border-slate-800"
                />
              </div>

              {settings.includeBranding && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-bold text-slate-500 uppercase">Agency Watermark Text</label>
                    <input
                      type="text"
                      value={settings.brandingText}
                      onChange={(e) => setSettings({ ...settings, brandingText: e.target.value })}
                      placeholder="Watermark / Agency Name"
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-800/40 pt-2">
                    <label className="text-[8px] font-bold text-slate-500 uppercase">Or Custom Logo Image Watermark</label>
                    <div className="flex items-center gap-2">
                      {settings.brandingLogoUrl ? (
                        <div className="relative w-12 h-12 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center p-1 group">
                          <img
                            src={settings.brandingLogoUrl}
                            alt="Custom Logo"
                            className="max-w-full max-h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, brandingLogoUrl: undefined })}
                            className="absolute inset-0 bg-slate-950/90 flex items-center justify-center text-rose-500 text-[8px] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove custom logo"
                          >
                            REMOVE
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <label className="flex items-center justify-center gap-1.5 border border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 hover:bg-slate-950 rounded-lg p-2 cursor-pointer text-slate-400 hover:text-slate-200 transition-all">
                            <Lucide.UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[10px] font-medium">Upload Logo (PNG/JPG)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setSettings({ ...settings, brandingLogoUrl: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                      {settings.brandingLogoUrl && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-mono text-emerald-400 uppercase font-bold">Image logo active</span>
                          <span className="text-[7px] text-slate-500">Hover badge image to remove or swap</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MAJOR TRIGGER: EXPORT CINEMATIC VIDEO */}
            <div className="border-t border-slate-800 pt-4">
              <button
                onClick={handleExportVideo}
                disabled={isExporting || slides.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 hover:from-indigo-600 hover:to-amber-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 transition-transform active:scale-98"
              >
                {isExporting ? (
                  <>
                    <Lucide.Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>EXPORTING HD VIDEO...</span>
                  </>
                ) : (
                  <>
                    <Lucide.Download className="w-4.5 h-4.5" />
                    <span>STITCH & DOWNLOAD VIDEO</span>
                  </>
                )}
              </button>
              
              {exportError && (
                <div className="mt-2 text-[10px] text-rose-400 font-medium">
                  Error: {exportError}
                </div>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* 3. FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-mono mt-auto shrink-0 select-none">
        <span>© 2026 AURA CINEMATIC PROPERTY TOURS</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-indigo-400 font-semibold">
            <Lucide.Sparkles className="w-3.5 h-3.5" />
            REAL-TIME MEDIARECORDER STITCHING ENGINE
          </span>
          <span>•</span>
          <span>HTML5 CANVAS PROJECTIONS</span>
        </div>
      </footer>
    </div>
  );
}
