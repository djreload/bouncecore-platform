export type SquareCheckoutErrorParam = "error" | "square-api-error" | "square-not-ready";

function isSquareApiError(error: unknown) {
  return error instanceof Error && error.name === "SquareApiError";
}

export function squareCheckoutErrorParam(error: unknown): SquareCheckoutErrorParam {
  if (isSquareApiError(error)) {
    return "square-api-error";
  }

  const message = error instanceof Error ? error.message : "";

  return message.includes("Square") ? "square-not-ready" : "error";
}
