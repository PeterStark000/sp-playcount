import GQLQuery, { JSONRecord } from "../query";

const GET_PLAYLIST_QUERY = `query getPlaylist($uri: ID!, $offset: Int, $limit: Int) {
  playlistV2(uri: $uri) {
    __typename
    uri
    name
    description
    images {
      items {
        sources {
          url
          width
          height
        }
      }
    }
    ownerV2 {
      __typename
      ... on User {
        uri
        profile {
          name
        }
      }
    }
    content(offset: $offset, limit: $limit) {
      totalCount
      items {
        uid
        addedAt {
          isoString
        }
        itemV2 {
          __typename
          ... on TrackResponseWrapper {
            track {
              uri
              name
              playcount
              discNumber
              trackNumber
              contentRating {
                label
              }
              duration {
                totalMilliseconds
              }
              playability {
                playable
              }
              artists {
                items {
                  uri
                  profile {
                    name
                  }
                }
              }
              album {
                uri
                name
                coverArt {
                  sources {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

export class GetPlaylistQuery extends GQLQuery {
    name: string = "fetchPlaylist";
    query: string = GET_PLAYLIST_QUERY;
    endpoint: string = "fetchPlaylist";

    get variables(): JSONRecord {
        return {
            uri: `spotify:playlist:${this.id}`,
            offset: 0,
            limit: 100
        };
    }
}

export class OldGetPlaylistQuery extends GetPlaylistQuery {
    endpoint: string = "fetchPlaylistContents";

    public parseResponse(json: JSONRecord): JSONRecord {
        const responseJson = json.data.playlistV2;
        const uri = responseJson.uri;
        const name = responseJson.name;
        
        // Playlist images itemV2 structure
        const cover = { uri: responseJson.images?.items[0]?.sources[0]?.url || "" };
        
        // Simulando datas para manter o padrão do objeto de Álbum
        const trackCount = responseJson.content.totalCount;

        // Mapeando faixas da Playlist
        const playlistTracks = responseJson.content.items
            .filter((item: any) => item.itemV2.__typename === "TrackResponseWrapper")
            .map((item: any) => {
                const track = item.itemV2.track;
                return {
                    uri: track.uri,
                    playcount: parseInt(track.playcount || "0"),
                    name: track.name,
                    popularity: 0,
                    number: track.trackNumber,
                    duration: track.duration.totalMilliseconds,
                    explicit: track.contentRating.label === "EXPLICIT",
                    playable: track.playability.playable,
                    artists: track.artists.items.map((artist: any) => ({
                        name: artist.profile.name,
                        uri: artist.uri,
                        image: { uri: "" }
                    })),
                    album: {
                        name: track.album.name,
                        uri: track.album.uri
                    }
                };
            });

        // Como Playlists não são divididas em discos nativamente como álbuns,
        // agrupamos tudo em um "Disco 1" para manter a compatibilidade com seu frontend.
        const discs = [{
            number: 1,
            name: name,
            tracks: playlistTracks
        }];

        return {
            uri: uri,
            name: name,
            description: responseJson.description,
            cover: cover,
            track_count: trackCount,
            discs: discs,
            copyrights: [], // Playlists geralmente não possuem este campo
            artists: [{
                name: responseJson.ownerV2?.profile?.name || "Spotify User",
                uri: responseJson.ownerV2?.uri || ""
            }],
            type: "playlist",
            label: "Playlist"
        };
    }
}