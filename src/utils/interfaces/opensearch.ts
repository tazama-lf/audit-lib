export interface IOpenSearchConfig {
  node: string | string[];
  auth?: {
    username: string;
    password: string;
  };
  ssl?: {
    rejectUnauthorized: boolean;
  };
  indexPrefix: string;
}