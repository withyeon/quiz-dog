import Image from 'next/image'

type PomeMascotProps = {
  className?: string
  shadow?: 'none' | 'sm' | 'md'
}

const shadowClassName = {
  none: '',
  sm: 'drop-shadow-sm',
  md: 'drop-shadow-md',
} satisfies Record<NonNullable<PomeMascotProps['shadow']>, string>

export default function PomeMascot({
  className = 'h-20 w-20',
  shadow = 'md',
}: PomeMascotProps) {
  return (
    <Image
      src="/mascot_pome.png"
      alt="퀴즈독 마스코트"
      width={96}
      height={96}
      className={`inline-block object-contain ${shadowClassName[shadow]} ${className}`}
    />
  )
}
