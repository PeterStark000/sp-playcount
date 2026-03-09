import { GetPlaylistQuery } from "./playlist";
import { JSONRecord } from "../query";

export class GetAGStatsQuery extends GetPlaylistQuery {
    endpoint = "AGStats";

    constructor(id: string = "") {
        super(id);
    }

    get variables(): JSONRecord {
        return {
            uri: `spotify:playlist:2yHQEWqbmpa34QLjpYI66T`,
            offset: 0,
            limit: 500, // Aumentado para garantir que pegue todas as músicas
            enableWatchFeedEntrypoint: true
        };
    }

    public parseResponse(responseJson: JSONRecord): JSONRecord {
        const parsedPlaylist = super.parseResponse(responseJson);
        const tracks = parsedPlaylist.tracks as any[];

        const stats = tracks.map(t => t.playcount);

        // Retorna a string formatada diretamente
        return stats.join("\n") as unknown as JSONRecord;
    }
}