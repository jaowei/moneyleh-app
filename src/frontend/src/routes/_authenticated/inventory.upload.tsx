import { createFileRoute } from '@tanstack/react-router'
import { fetchCompanies, fetchTagData, uiRouteClient, type FileUploadRes } from '../../lib/backend-clients'
import { useState, type ChangeEventHandler } from 'react'
import UploadViewer from '../../components/UploadViewer'
import { useAuth } from '../../context/auth'
import { getBackendErrorResponse } from '../../lib/error'

export const Route = createFileRoute('/_authenticated/inventory/upload')({
  component: RouteComponent,
  loader: async () => {
    const tagData = await fetchTagData()
    const companyData = await fetchCompanies();

    return ({
      tagData,
      companyData,
      crumb: 'Upload'
    })
  }
})

function RouteComponent() {
  const { tagData, companyData } = Route.useLoaderData()
  const { user } = useAuth()

  if (!user?.id) return <div>Please login</div>

  const [uploadInfo, setUploadInfo] = useState<FileUploadRes | undefined>()
  const [uploadError, setUploadError] = useState('')

  const handleClearClick = () => {
    setUploadInfo(undefined)
  }

  const handleFileStatementUploadInput: ChangeEventHandler<HTMLInputElement> = async (e) => {
    setUploadError('')
    const files = e.target.files
    const userId = user.id
    const targetFile = files?.[0]

    if (!userId) throw new Error('No user id!')
    if (!targetFile) throw new Error('No file found!')

    try {
      const res = await uiRouteClient.fileUpload.$post({
        form: {
          userId,
          file: files[0]
        },
      })
      if (res.ok) {
        const resData = await res.json()
        setUploadInfo(resData)
      } else {
        throw await getBackendErrorResponse(res)
      }
    } catch (error) {
      if (error instanceof Error) {
        setUploadError(`${error}`)
      } else {
        setUploadError(JSON.stringify(error))
      }
    }
  }

  return <div className='flex flex-col items-center gap-4'>
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-row items-center gap-4 content-center">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Upload a statement
          </legend>
          <input type='file' className='file-input' accept=".csv, .pdf, .xls, .xlsx"
            onChange={handleFileStatementUploadInput} />
          <p className="label">Upload your monthly bank/account statements</p>
          {uploadError &&
            <div className="alert alert-error">{uploadError}</div>
          }
        </fieldset>
        <button className="btn" onClick={handleClearClick}>Clear data</button>
      </div>
      {uploadInfo && uploadInfo.taggedTransactions?.length > 0 && (
        <div className="p-3">
          <h2 className="text-2xl font-bold">Statement Date: {uploadInfo.statementInfo.statementDate}</h2>
          <UploadViewer fileUploadRes={uploadInfo} userId={user.id}
            tagData={tagData} companies={companyData} />
        </div>
      )}
    </div>
  </div>
}
