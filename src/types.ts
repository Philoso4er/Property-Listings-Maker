export type PanType =
  | 'pan_left_to_right'
  | 'pan_right_to_left'
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_up'
  | 'pan_down'
  | 'diagonal_drift'
  | 'steady_hold';

export interface PropertySlide {
  id: string;
  imageUrl: string;
  name: string;
  panType: PanType;
  duration: number; // in seconds
  caption: string; // text overlay
}

export type MusicTrack = 'luxury_lounge' | 'jazz_cafe' | 'corporate_clean' | 'none';

export type VideoFilter = 'none' | 'vintage' | 'warm' | 'cool' | 'vibrant' | 'monochrome';

export type CaptionFont =
  | 'system-ui'
  | 'Playfair Display'
  | 'Cinzel'
  | 'Montserrat'
  | 'Space Grotesk'
  | 'Cormorant Garamond'
  | 'JetBrains Mono';

export type CaptionAnimation =
  | 'fade_in'
  | 'typewriter'
  | 'slide_up'
  | 'zoom'
  | 'none';

export type CaptionStyle =
  | 'elegant_glass'
  | 'minimal_dark'
  | 'classic_serif'
  | 'bold_banner'
  | 'clean_caption';

export interface VideoSettings {
  aspectRatio: '16:9' | '9:16' | '1:1';
  musicTrack: MusicTrack;
  filter: VideoFilter;
  includeBranding: boolean;
  brandingText: string;
  brandingLogoUrl?: string; // custom watermark image url or base64
  aiGuidance?: string; // user text guidelines to instruct the auto-caption generator
  captionFont?: CaptionFont;
  captionAnimation?: CaptionAnimation;
  captionStyle?: CaptionStyle;
}
