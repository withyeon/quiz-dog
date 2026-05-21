import { getDecodedRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import EditQuestionSetPageClient from './EditQuestionSetPageClient'

type EditQuestionSetPageProps = {
  params: AsyncRouteParams<'id'>
}

export default async function EditQuestionSetPage({ params }: EditQuestionSetPageProps) {
  const setId = await getDecodedRouteParam(params, 'id')

  return <EditQuestionSetPageClient setId={setId} />
}
