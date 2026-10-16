declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
