// components/Loading.tsx
export default function Loading({
  message = 'Loading...',
  fullPage = true,
  size = 'md',
}: {
  message?: string
  fullPage?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const spinnerSizes = {
    sm: 'h-8 w-8 border-2',
    md: 'h-12 w-12 border-t-2 border-b-2',
    lg: 'h-16 w-16 border-t-4 border-b-4',
  }

  const containerClasses = fullPage
    ? 'min-h-screen flex items-center justify-center'
    : 'flex items-center justify-center py-20'

  return (
    <div className={`${containerClasses} bg-linear-to-br from-gray-50 to-gray-100`}>
      <div className="text-center">
        <div
          className={`animate-spin rounded-full ${spinnerSizes[size]} border-cyan-500 mx-auto`}
          role="status"
          aria-label="Loading"
        />
        {message && <p className="mt-4 text-gray-600 font-medium">{message}</p>}
      </div>
    </div>
  )
}
