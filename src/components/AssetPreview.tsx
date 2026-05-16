import Image from 'next/image'
import { gameAssets } from '@/assets/game-assets'

type PreviewAsset = {
  tight: string
  icon32: string
  icon64: string
  icon128: string
}

export default function AssetPreview() {
  const assets = Object.entries(gameAssets) as Array<[string, PreviewAsset]>

  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        raw-assets에 이미지를 넣고 npm run assets를 실행하면 에셋 미리보기가 표시됩니다.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {assets.map(([name, asset]) => (
        <div
          key={name}
          className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <Image
            src={asset.icon64}
            alt={name}
            width={64}
            height={64}
            unoptimized
            className="pixelated h-16 w-16 object-contain"
          />
          <span className="max-w-full truncate text-sm font-medium text-gray-700">
            {name}
          </span>
        </div>
      ))}
    </div>
  )
}
