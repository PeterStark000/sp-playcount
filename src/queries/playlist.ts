import GQLQuery, { JSONRecord } from "../query";

// The query string is not needed when using a known persisted query hash.
const GET_PLAYLIST_QUERY = "";

export class GetPlaylistQuery extends GQLQuery {
    name: string = "fetchPlaylist";
    query: string = GET_PLAYLIST_QUERY;
    endpoint: string = "getPlaylist";

    get variables(): JSONRecord {
        return {
            uri: `spotify:playlist:${this.id}`,
            offset: 0,
            limit: 200,
            enableWatchFeedEntrypoint: true
        }
    }

    public async getExtensions(): Promise<JSONRecord> {
        return {
            persistedQuery: {
                version: 1,
                sha256Hash: "9c53fb83f35c6a177be88bf1b67cb080b853e86b576ed174216faa8f9164fc8f"
            }
        };
    }

    public parseResponse(responseJson: JSONRecord): JSONRecord {
        const playlist = responseJson.data.playlistV2;

        if (!playlist) {
            throw new Error("Playlist not found");
        }

        const tracks = playlist.content?.items?.map((item: any) => {
            const track = item?.itemV2?.data;
            if (!track) return null;

            return {
                uri: track.uri,
                name: track.name,
                playcount: parseInt(track.playcount || "0"),
                duration: track.trackDuration?.totalMilliseconds || 0,
                explicit: track.contentRating?.label === "EXPLICIT",
                playable: track.playability?.playable ?? false,
                album: {
                    uri: track.albumOfTrack?.uri,
                    name: track.albumOfTrack?.name,
                },
                artists: track.artists?.items?.map((artist: any) => ({
                    uri: artist.uri,
                    name: artist.profile.name
                })) || []
            };
        }).filter(Boolean) || [];

        return {
            uri: playlist.uri,
            name: playlist.name,
            description: playlist.description,
            owner: {
                name: playlist.ownerV2?.data?.name || "Unknown"
            },
            cover: playlist.images?.items?.[0]?.sources?.[0]?.url,
            followers: playlist.followers,
            total_tracks: playlist.content?.totalCount || 0,
            tracks
        };
    }
}