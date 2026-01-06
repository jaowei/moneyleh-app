import { createFileRoute } from '@tanstack/react-router'
import { StatementUploader } from '../../components/StatementUploader'
import { fetchTagData } from '../../lib/backend-clients'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/inventory/upload')({
  component: RouteComponent,
  loader: async () => {
    const tagData = await fetchTagData()

    return ({
      tagData,
      crumb: 'Upload'
    })
  }
})

type UploadStates = 'success' | 'error' | 'notStarted'

const getSecondStepClassName = (state: UploadStates) => {
  switch (state) {
    case 'success':
      return 'step step-primary'
    case 'error':
      return 'step step-error'
    case 'notStarted':
      return 'step'
    default:
      return 'step'
  }
}

function RouteComponent() {
  const { tagData } = Route.useLoaderData()

  const [toReview, setToReview] = useState<UploadStates>('notStarted')

  const handleStatementUploaded = () => {
    setToReview('success')
  }
  const handleStatementUploadError = () => {
    setToReview('error')
  }


  return <div className='flex flex-col items-center gap-4'>
    <ul className="steps">
      <li className="step step-primary">Upload a statement</li>
      <li className={getSecondStepClassName(toReview)}>Review and edit tags and extracted values</li>
      <li className="step">Save</li>
    </ul>
    <StatementUploader tagData={tagData} onStatementUploaded={handleStatementUploaded} onStatementUploadError={handleStatementUploadError} />
  </div>
}
