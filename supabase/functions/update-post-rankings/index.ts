import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting post and wiki ranking update...");

    // 정렬 타입들
    const sortTypes = ["hot", "top", "best"];
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 72); // 72시간 이전 게시물

    // ===== Process Posts =====
    for (const sortType of sortTypes) {
      console.log(`Processing posts ${sortType} rankings...`);

      // 게시물 가져오기 (approved만)
      const { data: posts, error: fetchError } = await supabaseAdmin
        .from("posts")
        .select("id, votes, created_at, view_count, comment_count:comments(count)")
        .eq("is_approved", true)
        .gte("created_at", cutoffDate.toISOString())
        .order("votes", { ascending: false });

      if (fetchError) {
        console.error(`Error fetching posts for ${sortType}:`, fetchError);
        continue;
      }

      if (!posts || posts.length === 0) {
        console.log(`No posts found for ${sortType}`);
        continue;
      }

      // 정렬 로직
      let sortedPosts = [...posts];

      if (sortType === "hot") {
        const now = Date.now();
        sortedPosts.sort((a, b) => {
          const hoursA = (now - new Date(a.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const hoursB = (now - new Date(b.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const scoreA = ((a.votes || 0) * 10 + (a.view_count || 0)) / Math.pow(hoursA, 1.5);
          const scoreB = ((b.votes || 0) * 10 + (b.view_count || 0)) / Math.pow(hoursB, 1.5);
          return scoreB - scoreA;
        });
      } else if (sortType === "best") {
        const now = Date.now();
        sortedPosts.sort((a, b) => {
          const hoursA = (now - new Date(a.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const hoursB = (now - new Date(b.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const commentCountA = Array.isArray(a.comment_count) ? a.comment_count.length : 0;
          const commentCountB = Array.isArray(b.comment_count) ? b.comment_count.length : 0;
          const scoreA = ((a.votes || 0) * 10 + commentCountA * 5 + (a.view_count || 0)) / Math.pow(hoursA, 1.2);
          const scoreB = ((b.votes || 0) * 10 + commentCountB * 5 + (b.view_count || 0)) / Math.pow(hoursB, 1.2);
          return scoreB - scoreA;
        });
      }
      // top은 이미 votes로 정렬됨

      // 상위 12개만 순위 저장
      const rankings = sortedPosts.slice(0, 12).map((post, index) => ({
        post_id: post.id,
        rank: index + 1,
        sort_type: sortType,
      }));

      if (rankings.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("post_rankings")
          .insert(rankings);

        if (insertError) {
          console.error(`Error inserting rankings for ${sortType}:`, insertError);
        } else {
          console.log(`Saved ${rankings.length} rankings for ${sortType}`);
        }
      }

      // Update trending_score for each post
      for (const post of sortedPosts) {
        const commentCount = Array.isArray(post.comment_count) ? post.comment_count.length : 0;
        const trendingScore = 
          (post.votes || 0) * 10 + 
          (post.view_count || 0) + 
          commentCount * 5;

        await supabaseAdmin
          .from("posts")
          .update({ trending_score: trendingScore })
          .eq("id", post.id);
      }
    }

    // ===== Process Wiki Entries =====
    for (const sortType of sortTypes) {
      console.log(`Processing wiki ${sortType} rankings...`);

      // 위키 엔트리 가져오기
      const { data: wikiEntries, error: fetchError } = await supabaseAdmin
        .from("wiki_entries")
        .select("id, votes, created_at")
        .gte("created_at", cutoffDate.toISOString())
        .order("votes", { ascending: false });

      if (fetchError) {
        console.error(`Error fetching wiki entries for ${sortType}:`, fetchError);
        continue;
      }

      if (!wikiEntries || wikiEntries.length === 0) {
        console.log(`No wiki entries found for ${sortType}`);
        continue;
      }

      // Get comment counts for wiki entries
      const wikiEntryIds = wikiEntries.map(entry => entry.id);
      const { data: wikiComments } = await supabaseAdmin
        .from("comments")
        .select("wiki_entry_id")
        .in("wiki_entry_id", wikiEntryIds);

      // Count comments per wiki entry
      const wikiCommentCountMap = new Map<string, number>();
      wikiComments?.forEach((comment: any) => {
        const count = wikiCommentCountMap.get(comment.wiki_entry_id) || 0;
        wikiCommentCountMap.set(comment.wiki_entry_id, count + 1);
      });

      // Add comment counts to wiki entries
      const wikiEntriesWithComments = wikiEntries.map(entry => ({
        ...entry,
        comment_count: wikiCommentCountMap.get(entry.id) || 0
      }));

      // 정렬 로직
      let sortedWikiEntries = [...wikiEntriesWithComments];

      if (sortType === "hot") {
        const now = Date.now();
        sortedWikiEntries.sort((a, b) => {
          const hoursA = (now - new Date(a.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const hoursB = (now - new Date(b.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const scoreA = (a.votes || 0) / Math.pow(hoursA, 1.5);
          const scoreB = (b.votes || 0) / Math.pow(hoursB, 1.5);
          return scoreB - scoreA;
        });
      } else if (sortType === "best") {
        const now = Date.now();
        sortedWikiEntries.sort((a, b) => {
          const hoursA = (now - new Date(a.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const hoursB = (now - new Date(b.created_at).getTime()) / (1000 * 60 * 60) + 2;
          const scoreA = ((a.votes || 0) * 0.7 + a.comment_count * 0.3) / Math.pow(hoursA, 1.2);
          const scoreB = ((b.votes || 0) * 0.7 + b.comment_count * 0.3) / Math.pow(hoursB, 1.2);
          return scoreB - scoreA;
        });
      }
      // top은 이미 votes로 정렬됨

      // 상위 12개만 순위 저장
      const wikiRankings = sortedWikiEntries.slice(0, 12).map((entry, index) => ({
        wiki_entry_id: entry.id,
        rank: index + 1,
        sort_type: sortType,
      }));

      if (wikiRankings.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("wiki_entry_rankings")
          .insert(wikiRankings);

        if (insertError) {
          console.error(`Error inserting wiki rankings for ${sortType}:`, insertError);
        } else {
          console.log(`Saved ${wikiRankings.length} wiki rankings for ${sortType}`);
        }
      }
    }

    // 7일 이상 된 순위 데이터 삭제 (posts)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error: deleteError } = await supabaseAdmin
      .from("post_rankings")
      .delete()
      .lt("snapshot_at", sevenDaysAgo.toISOString());

    if (deleteError) {
      console.error("Error cleaning old post rankings:", deleteError);
    } else {
      console.log("Cleaned old post rankings");
    }

    // 7일 이상 된 순위 데이터 삭제 (wiki entries)
    const { error: deleteWikiError } = await supabaseAdmin
      .from("wiki_entry_rankings")
      .delete()
      .lt("snapshot_at", sevenDaysAgo.toISOString());

    if (deleteWikiError) {
      console.error("Error cleaning old wiki rankings:", deleteWikiError);
    } else {
      console.log("Cleaned old wiki rankings");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Rankings updated successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in update-post-rankings:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
