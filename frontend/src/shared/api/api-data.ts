import { httpClient } from "./http-client";
export async function apiData<T>(
  method: string,
  url: string,
  data?: unknown,
): Promise<T> {
  const response = await httpClient.request<{ data: T }>({ method, url, data });
  return response.data.data;
}
