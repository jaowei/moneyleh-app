import type { FormApi } from "final-form";
import { Field, Form } from "react-final-form";
import type { UsersResponse } from "../lib/auth-client";
import type { TransactionSplitUI } from "../lib/backend-clients";
import { ModalCloseFooterButton } from "./ModalCloseButton";

interface TransactionSplitModalProps {
	ref: React.RefObject<HTMLDialogElement | null>;
	split?: TransactionSplitUI;
	onModalClose: () => void;
	onSplitChange: (split?: TransactionSplitUI) => void;
	usersRes: UsersResponse;
}
interface TransactionSplitButtonProps {
	onClick: () => void;
	hasSplit?: boolean;
	disabled?: boolean;
	forTable?: boolean;
}

export const TransactionSplitModal = ({
	ref,
	split,
	usersRes,
	onSplitChange,
	onModalClose,
}: TransactionSplitModalProps) => {
	const onSubmit = (
		values: TransactionSplitUI,
		form: FormApi<TransactionSplitUI>,
	) => {
		onSplitChange(values);
		form.reset();
		onModalClose();
	};
	return (
		<dialog ref={ref} className="modal">
			<div className="modal-box">
				<div className="flex flex-col gap-4 items-center w-full">
					<Form
						onSubmit={onSubmit}
						initialValues={{
							share: split?.share,
							userId: split?.userId,
						}}
						render={({ handleSubmit, errors, form, values }) => {
							const handleClearClick = () => {
								onSplitChange(undefined);
								form.reset({
									share: undefined,
									userId: undefined,
								});
							};
							return (
								<form className="w-full" onSubmit={handleSubmit}>
									<fieldset className="fieldset">
										<legend className="fieldset-legend">
											Splitting transaction
										</legend>
										<label htmlFor="" className="label">
											User to split with
										</label>
										<Field<string>
											name="userId"
											component="select"
											className="select"
											validate={(value) => (!value ? "Required" : undefined)}
										>
											<option>Pick a user</option>
											{usersRes.users.map((user) => (
												<option key={user.email} value={user.id}>
													{user.email}
												</option>
											))}
										</Field>
										{errors?.shareUserId && (
											<p className="text-error">{errors.shareUserId}</p>
										)}
										<label htmlFor="" className="label">
											Share of other user
										</label>
										<Field<number>
											name="share"
											component="input"
											type="number"
											className="input"
											placeholder="Type a number between 0 to 100%"
											validate={(value) => {
												if (value === undefined) return "Required";
												return value < 1 || value > 100
													? "Must be between 1 and 100"
													: undefined;
											}}
											parse={(value) => {
												if (value === undefined) return value;
												return parseInt(value, 10);
											}}
										></Field>
										{errors?.share && (
											<p className="text-error">{errors.share}</p>
										)}
										<div className="flex flex-row gap-2 w-full">
											<button className="btn btn-sm btn-neutral" type="submit">
												Split transaction
											</button>
											{!!values?.share && (
												<button
													className="btn btn-sm btn-warning"
													type="button"
													onClick={handleClearClick}
												>
													Remove split
												</button>
											)}
										</div>
									</fieldset>
								</form>
							);
						}}
					/>
				</div>
				<div className="modal-action">
					<ModalCloseFooterButton onModalClose={onModalClose} />
				</div>
			</div>
		</dialog>
	);
};

export const TransactionSplitButton = ({
	onClick,
	hasSplit = false,
	disabled = false,
	forTable = false,
}: TransactionSplitButtonProps) => (
	<div className="flex items-center justify-center flex-wrap gap-2 max-w-[35vw]">
		<div className="indicator">
			{hasSplit && (
				<span className="indicator-item status status-secondary"></span>
			)}
			<button
				type="button"
				className={`btn ${forTable ? "btn-xs" : "btn-sm"} btn-accent`}
				disabled={disabled}
				onClick={onClick}
			>
				{!forTable && "Apply Splits"}
				<span className="icon-[fluent--arrow-split-24-filled]"></span>
			</button>
		</div>
	</div>
);
