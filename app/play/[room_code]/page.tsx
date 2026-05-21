import { getRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import PlayPageClient from './PlayPageClient'

type PlayPageProps = {
  params: AsyncRouteParams<'room_code'>
}

export default async function PlayPage({ params }: PlayPageProps) {
  const room_code = await getRouteParam(params, 'room_code')
  const roomCode = (room_code || '').replace(/[^0-9]/g, '')

  return <PlayPageClient roomCode={roomCode} />
}
