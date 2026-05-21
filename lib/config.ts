export function allowLocalLogin() {
  return process.env.NODE_ENV !== "production" || process.env.TOKENMAXING_ALLOW_LOCAL_LOGIN === "true";
}

export function allowLocalSubmit() {
  return process.env.NODE_ENV !== "production" || process.env.TOKENMAXING_ALLOW_LOCAL_SUBMIT === "true";
}
