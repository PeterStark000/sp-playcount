import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';
import { GetAlbumQuery, OldGetAlbumQuery } from './queries/album';
import { GetAlbumTracksQuery } from './queries/track';
import { GetArtistInsights, GetArtistQuery } from './queries/artist';
import { GetPlaylistQuery } from './queries/playlist';
import { GetAGStatsQuery } from './queries/agstats';
import { spotifyRequest } from './spotify';

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use("/:query", cors());
app.use("/:query", (c, next) => {
  if (c.req.query("cache") === "false") {
    return next();
  }
  return cache({cacheName: "cache", cacheControl: "max-age=21600"})(c, next);
});
app.get("/:query", async (c) => {
  const userQuery = c.req.param("query");
  let id = c.req.query("id") || c.req.query("albumid") || c.req.query("artistid");

  if (id === undefined) {
    if (userQuery === "AGStats") {
      id = "";
    } else {
      return c.json({success: false, data: "id is not defined in the query"}, 400);
    }
  } else if (id.length != 22 && userQuery !== "AGStats") {
    return c.json({success: false, data: "id must have a length of 22 characters"}, 400);
  }

  const queries = [
    new GetAlbumQuery(id),
    new OldGetAlbumQuery(id),
    new GetAlbumTracksQuery(id),
    new GetArtistQuery(id),
    new GetArtistInsights(id),
    new GetPlaylistQuery(id),
    new GetAGStatsQuery()
  ];

  const query = queries.find(query => query.endpoint === userQuery);
  if (query === undefined) {
    return c.json({success: false, data: `Query not found: ${userQuery}`}, 404);
  }

  try {
    const response = await spotifyRequest(query);
    const data = response.data;
    const union = data.artistUnion || data.albumUnion || data.playlistUnion;
    const playlist = data.playlistV2;

    if ((union === undefined && playlist === undefined) || union?.__typename === "NotFound" || playlist === null) {
      return c.json({success: false, data: `id not found: ${id}`}, 404)
    }

    try {
      const parsed = query.parseResponse(response);
      if (userQuery === "AGStats") {
        return c.text(parsed as unknown as string);
      }
      return c.json({success: true, data: parsed});
    } catch (e) {
      return c.json({success: false, data: `Error when parsing response: ${e}`}, 500)
    }
  } catch (e) {
    return c.json({success: false, data: `An unknown error occurred: ${e}`}, 500);
  }
});

export default app;
