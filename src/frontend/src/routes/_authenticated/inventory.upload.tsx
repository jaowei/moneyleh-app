import { createFileRoute } from "@tanstack/react-router";
import { type ChangeEventHandler, useState } from "react";
import UploadViewer from "../../components/UploadViewer";
import { useAuth } from "../../context/auth";
import {
	type FileUploadRes,
	fetchCompanies,
	fetchTagData,
	uiRouteClient,
} from "../../lib/backend-clients";
import { getBackendErrorResponse } from "../../lib/error";

export const Route = createFileRoute("/_authenticated/inventory/upload")({
	component: RouteComponent,
	loader: async () => {
		const tagData = await fetchTagData();
		const companyData = await fetchCompanies();

		return {
			tagData,
			companyData,
			crumb: "Upload",
		};
	},
});

function RouteComponent() {
	const { tagData, companyData } = Route.useLoaderData();
	const { user } = useAuth();

	const [uploadInfo, setUploadInfo] = useState<FileUploadRes | undefined>();
	const [uploadError, setUploadError] = useState("");

	if (!user?.id) return <div>Please login</div>;

	const handleClearClick = () => {
		setUploadInfo(undefined);
	};

	const handleFileStatementUploadInput: ChangeEventHandler<
		HTMLInputElement
	> = async (e) => {
		setUploadError("");
		const files = e.target.files;
		const userId = user.id;
		const targetFile = files?.[0];

		if (!userId) throw new Error("No user id!");
		if (!targetFile) throw new Error("No file found!");

		try {
			const res = await uiRouteClient.fileUpload.$post({
				form: {
					userId,
					file: files[0],
				},
			});
			if (res.ok) {
				const resData = await res.json();
				setUploadInfo(resData);
			} else {
				throw await getBackendErrorResponse(res);
			}
		} catch (error) {
			if (error instanceof Error) {
				setUploadError(`${error}`);
			} else {
				setUploadError(JSON.stringify(error));
			}
		}
	};

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="flex flex-col items-center gap-4">
				<div className="flex flex-row items-center gap-4 content-center">
					<fieldset className="fieldset">
						<legend className="fieldset-legend">Upload a statement</legend>
						<input
							type="file"
							className="file-input input-sm"
							accept=".csv, .pdf, .xls, .xlsx"
							onChange={handleFileStatementUploadInput}
						/>
						<p className="fieldset-label">
							Upload your monthly bank/account statements
						</p>
						{uploadError && (
							<div className="alert alert-error">{uploadError}</div>
						)}
					</fieldset>
					<fieldset className="fieldset">
						<legend className="fieldset-legend"></legend>
						<button
							type="button"
							className="btn btn-sm"
							onClick={handleClearClick}
						>
							Clear data
						</button>
						<p className="fieldset-label"></p>
					</fieldset>
				</div>
				{uploadInfo && uploadInfo.taggedTransactions?.length > 0 && (
					<div className="p-3">
						<h2 className="text:xl xl:text-2xl font-bold">
							Statement Date: {uploadInfo.statementInfo.statementDate}
						</h2>
						<UploadViewer
							fileUploadRes={uploadInfo}
							userId={user.id}
							tagData={tagData}
							companies={companyData}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
