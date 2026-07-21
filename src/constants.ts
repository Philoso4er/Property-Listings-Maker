import { PropertySlide } from './types';

export const DEFAULT_SLIDES: PropertySlide[] = [
  {
    id: 'slide_1',
    imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80',
    name: 'Living Room Sanctuary',
    panType: 'pan_left_to_right',
    duration: 5,
    caption: 'Welcome to this sun-kissed architectural sanctuary, showcasing organic materials and high ceilings.'
  },
  {
    id: 'slide_2',
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
    name: 'Industrial Chef Kitchen',
    panType: 'zoom_in',
    duration: 5,
    caption: 'The professional chef\'s kitchen features custom stone countertops and premium appliances.'
  },
  {
    id: 'slide_3',
    imageUrl: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80',
    name: 'Mid-Century Woodland Suite',
    panType: 'pan_right_to_left',
    duration: 6,
    caption: 'Oversized glass portals integrate the changing seasonal colors of the surrounding forest.'
  }
];

export const PAN_OPTIONS = [
  { value: 'pan_left_to_right', label: 'Pan Left to Right', icon: 'ArrowRight' },
  { value: 'pan_right_to_left', label: 'Pan Right to Left', icon: 'ArrowLeft' },
  { value: 'zoom_in', label: 'Slow Zoom In', icon: 'ZoomIn' },
  { value: 'zoom_out', label: 'Slow Zoom Out', icon: 'ZoomOut' },
  { value: 'pan_up', label: 'Pan Up', icon: 'ArrowUp' },
  { value: 'pan_down', label: 'Pan Down', icon: 'ArrowDown' },
  { value: 'diagonal_drift', label: 'Diagonal Drift', icon: 'TrendingUp' },
  { value: 'steady_hold', label: 'Steady Focus Hold', icon: 'Minimize2' }
];

export const FILTER_OPTIONS = [
  { value: 'none', label: 'Original', description: 'Clean, unfiltered' },
  { value: 'vintage', label: 'Warm Vintage', description: 'Soft golden glow' },
  { value: 'warm', label: 'Luxury Amber', description: 'Warm and inviting highlights' },
  { value: 'cool', label: 'Modern Platinum', description: 'Cool slate modern tones' },
  { value: 'vibrant', label: 'High Contrast', description: 'Rich shadows and high sat' },
  { value: 'monochrome', label: 'Classic Noir', description: 'Elegant black and white' }
];

export const MUSIC_OPTIONS = [
  { value: 'luxury_lounge', label: 'Luxury Lounge Pad' },
  { value: 'jazz_cafe', label: 'Cozy Jazz Cafe' },
  { value: 'corporate_clean', label: 'Corporate Minimalist' },
  { value: 'none', label: 'No Audio (Mute)' }
];
