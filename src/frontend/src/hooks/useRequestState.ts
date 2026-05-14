import { useState } from "react";

export const useRequestState = () => {
	const [requestSuccess, setRequestSuccess] = useState(false);
	const [error, setError] = useState("");
	const onSuccess = () => {
		setRequestSuccess(true);
	};
	const onError = (error: unknown) => {
		if (error instanceof Error) {
			setError(error.message);
		} else if (typeof error === "string") {
			setError(error);
		} else {
			setError(JSON.stringify(error));
		}
	};
	const reset = () => {
		setError("");
		setRequestSuccess(false);
	};
	return {
		requestSuccess,
		error,
		onSuccess,
		onError,
		reset,
	};
};
