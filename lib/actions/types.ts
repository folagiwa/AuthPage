export interface ActionResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  redirectUrl?: string;
}
