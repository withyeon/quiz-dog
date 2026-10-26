import { getDecodedRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import EditVocabSetPageClient from './EditVocabSetPageClient'

type EditVocabSetPageProps = {
  params: AsyncRouteParams<'id'>
}

export default async function EditVocabSetPage({ params }: EditVocabSetPageProps) {
  const setId = await getDecodedRouteParam(params, 'id')

  return <EditVocabSetPageClient setId={setId} />
}
