import { fetchWithTimeout } from "../../lib/outboundUrl.js";
import { getContactGoogleSyncConfig, GoogleSyncError } from "./contactGoogleSyncConfig.js";
import { refreshGoogleAccessToken } from "./contactGoogleSyncOAuth.js";
import type { GoogleConnection } from "./contactGoogleSyncMapping.js";

export const GOOGLE_PEOPLE_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies";

export interface GooglePeopleResponse {
  connections?: GoogleConnection[];
  nextPageToken?: string;
  error?: { message?: string };
}

export async function fetchGoogleConnectionsPage(
  accessToken: string,
  pageToken?: string,
): Promise<GooglePeopleResponse> {
  const url = new URL("https://people.googleapis.com/v1/people/me/connections");
  url.searchParams.set("personFields", GOOGLE_PEOPLE_FIELDS);
  url.searchParams.set("pageSize", "1000");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new GoogleSyncError("Google access token expired", "session_expired");
  }

  const peopleResponse = (await res.json()) as GooglePeopleResponse;
  if (peopleResponse.error?.message) {
    throw new GoogleSyncError(peopleResponse.error.message, "api_error");
  }

  return peopleResponse;
}

export async function fetchAllGoogleConnections(accessToken: string): Promise<GoogleConnection[]> {
  const all: GoogleConnection[] = [];
  let pageToken = "";

  do {
    const connectionsPage = await fetchGoogleConnectionsPage(accessToken, pageToken || undefined);
    all.push(...(connectionsPage.connections || []));
    pageToken = connectionsPage.nextPageToken || "";
  } while (pageToken);

  return all;
}

export async function fetchGoogleConnectionsWithRefresh(
  userId: string,
): Promise<GoogleConnection[]> {
  const config = await getContactGoogleSyncConfig(userId);
  if (!config.accessToken) {
    throw new GoogleSyncError("Google account not connected", "not_connected");
  }

  try {
    return await fetchAllGoogleConnections(config.accessToken);
  } catch (error) {
    if (!(error instanceof GoogleSyncError) || error.code !== "session_expired") {
      throw error;
    }
    const refreshed = await refreshGoogleAccessToken(userId);
    return fetchAllGoogleConnections(refreshed);
  }
}
