import { sql } from "drizzle-orm";
import { db } from "@main/db";
import { keywordSnapshots } from "@main/db/schema";

/** Extra same-day snapshots (manual refreshes) are kept this long, then only the day's last stays. */
const KEEP_ALL_MS = 48 * 3_600_000;
/** Older snapshots keep only the top of the ranking; deeper positions read as unranked. */
const TRIM_AFTER_MS = 90 * 24 * 3_600_000;
const TRIMMED_DEPTH = 100;

/**
 * Bounds the history's growth without losing any day: trends only use each day's last
 * snapshot, and long-term trends don't need positions past the top 100.
 */
export function compactSnapshots(now = Date.now()) {
  const s = keywordSnapshots;
  const localDay = sql`date(${s.fetchedAt} / 1000, 'unixepoch', 'localtime')`;
  db.transaction((tx) => {
    tx.run(sql`
      delete from ${s}
      where ${s.fetchedAt} < ${now - KEEP_ALL_MS}
        and ${s.id} not in (
          select id from (
            select ${s.id} as id, row_number() over (
              partition by ${s.keywordId}, ${localDay} order by ${s.fetchedAt} desc, ${s.id} desc
            ) as rn
            from ${s}
          ) where rn = 1
        )
    `);
    tx.run(sql`
      update ${s}
      set ranked_app_ids = (
        select json_group_array(value) from (
          select value from json_each(${s.rankedAppIds}) order by key limit ${TRIMMED_DEPTH}
        )
      )
      where ${s.fetchedAt} < ${now - TRIM_AFTER_MS} and json_array_length(${s.rankedAppIds}) > ${TRIMMED_DEPTH}
    `);
  });
}
