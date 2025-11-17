export const ERROR_MESSAGES = {
    GENERIC: "Something goofed! Please contact developer",
};

export const getBackendErrorResponse = async (res: Response) => {
    return new Error(`Backend returned an error: ${await res.text()}`)
}