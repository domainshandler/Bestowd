/** An error with an HTTP status. The app's error handler sends `{ error: message }` with this status. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = () => new HttpError(404, 'Not found')
export const badRequest = (message: string) => new HttpError(400, message)
export const forbidden = () => new HttpError(403, 'Forbidden')
export const conflict = (message: string) => new HttpError(409, message)
export const gone = (message: string) => new HttpError(410, message)
