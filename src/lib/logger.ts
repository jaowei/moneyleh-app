import dayjs from "dayjs";

export const appLogger = (message: string, ...rest: string[]) => {
	console.log(`[${dayjs().toISOString()}] ${message}`, ...rest);
};
