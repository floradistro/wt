/**
 * Image Transformation Utilities
 * Optimizes Supabase Storage images for different use cases
 *
 * Apple Engineering Principle: Performance matters
 * - Use thumbnails for list views (60x60, 100x100)
 * - Use full resolution only when needed (detail views, preview)
 * - Automatic WebP conversion when supported
 */

export type ImageSize = 'icon' | 'thumbnail' | 'medium' | 'large' | 'full'

interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
  resize?: 'cover' | 'contain' | 'fill'
}

/**
 * Predefined image sizes for consistent usage across app
 */
const IMAGE_SIZES: Record<ImageSize, ImageTransformOptions> = {
  // 60x60 - List items, category icons (Apple Music style)
  icon: {
    width: 60,
    height: 60,
    quality: 75,
    format: 'webp',
    resize: 'cover',
  },
  // 100x100 - Detail view headers, larger thumbnails
  thumbnail: {
    width: 100,
    height: 100,
    quality: 80,
    format: 'webp',
    resize: 'cover',
  },
  // 300x300 - Medium resolution for modals, previews
  medium: {
    width: 300,
    height: 300,
    quality: 85,
    format: 'webp',
    resize: 'contain',
  },
  // 600x600 - Large resolution for full-screen previews
  large: {
    width: 600,
    height: 600,
    quality: 90,
    format: 'webp',
    resize: 'contain',
  },
  // Original - No transformation (use sparingly)
  full: {},
}

/**
 * Transform a Supabase Storage URL to use image transformations
 *
 * @example
 * const url = 'https://xxx.supabase.co/storage/v1/object/public/vendor-product-images/vendor-id/image.jpg'
 * const icon = getOptimizedImageUrl(url, 'icon')
 * // Returns: https://xxx.supabase.co/storage/v1/render/image/public/vendor-product-images/vendor-id/image.jpg?width=60&height=60&resize=cover
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  size: ImageSize = 'thumbnail'
): string | null {
  if (!url) return null

  // Skip transformation if not a Supabase storage URL
  if (!url.includes('supabase.co/storage/v1/object/public/')) {
    return url
  }

  // Return full-size if requested
  if (size === 'full') {
    return url
  }

  // Get transform options for size
  const options = IMAGE_SIZES[size]

  // Transform URL: /object/public/ -> /render/image/public/
  const transformedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  )

  // Build query parameters
  const params = new URLSearchParams()
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.resize) params.append('resize', options.resize)

  return `${transformedUrl}?${params.toString()}`
}

/**
 * Get icon-sized image (60x60) - for list views
 * Use this for: ProductItem, CategoryItem, POSProductCard
 */
export function getIconImage(url: string | null | undefined): string | null {
  return getOptimizedImageUrl(url, 'icon')
}

/**
 * Get thumbnail-sized image (100x100) - for detail headers
 * Use this for: ProductDetail header, CategoryDetail header
 */
export function getThumbnailImage(url: string | null | undefined): string | null {
  return getOptimizedImageUrl(url, 'thumbnail')
}

/**
 * Get medium-sized image (300x300) - for modals and previews
 * Use this for: MediaPickerModal, ImagePreviewModal
 */
export function getMediumImage(url: string | null | undefined): string | null {
  return getOptimizedImageUrl(url, 'medium')
}

/**
 * Get large-sized image (600x600) - for full-screen previews
 * Use this for: ImagePreviewModal full view
 */
export function getLargeImage(url: string | null | undefined): string | null {
  return getOptimizedImageUrl(url, 'large')
}

/**
 * Custom size transformation
 * Use when predefined sizes don't fit your needs
 */
export function getCustomSizeImage(
  url: string | null | undefined,
  options: ImageTransformOptions
): string | null {
  if (!url) return null

  // Skip transformation if not a Supabase storage URL
  if (!url.includes('supabase.co/storage/v1/object/public/')) {
    return url
  }

  // Transform URL: /object/public/ -> /render/image/public/
  const transformedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  )

  // Build query parameters
  const params = new URLSearchParams()
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.resize) params.append('resize', options.resize)

  return params.toString() ? `${transformedUrl}?${params.toString()}` : transformedUrl
}
