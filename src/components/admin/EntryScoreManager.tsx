import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, Save, Eye, Users, TrendingUp, Loader2, Lock, Sparkles, Unlock, ThumbsUp } from "lucide-react";

interface WikiEntry {
  id: string;
  title: string;
  slug: string;
  schema_type: string;
  image_url: string | null;
  view_count: number;
  follower_count: number;
  votes: number;
  trending_score: number;
}

export const EntryScoreManager = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WikiEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WikiEntry | null>(null);
  const [editValues, setEditValues] = useState({
    votes: 0,
    view_count: 0,
    follower_count: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // 잠긴 엔트리 랜덤 투표 추가 상태 (100-200)
  const [lockedEntryCount, setLockedEntryCount] = useState<number>(0);
  const [isAddingRandomVotes, setIsAddingRandomVotes] = useState(false);
  const [randomVoteProgress, setRandomVoteProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [lastResult1, setLastResult1] = useState<{
    processedCount: number;
    totalVotesAdded: number;
    completedAt: string;
  } | null>(null);
  
  // 잠긴 엔트리 랜덤 투표 추가 상태 2 (8-60)
  const [isAddingRandomVotes2, setIsAddingRandomVotes2] = useState(false);
  const [randomVoteProgress2, setRandomVoteProgress2] = useState(0);
  const [processedCount2, setProcessedCount2] = useState(0);
  const [lastResult2, setLastResult2] = useState<{
    processedCount: number;
    totalVotesAdded: number;
    totalViewsAdded: number;
    completedAt: string;
  } | null>(null);
  
  // 잠긴 엔트리 랜덤 조회수 추가 상태 (100-200)
  const [isAddingLockedViews, setIsAddingLockedViews] = useState(false);
  const [lockedViewsProgress, setLockedViewsProgress] = useState(0);
  const [lockedViewsProcessedCount, setLockedViewsProcessedCount] = useState(0);
  const [lastResultLockedViews, setLastResultLockedViews] = useState<{
    processedCount: number;
    totalViewsAdded: number;
    completedAt: string;
  } | null>(null);
  
  // 잠긴 엔트리 랜덤 팔로워 추가 상태 (6-88)
  const [isAddingLockedFollowers, setIsAddingLockedFollowers] = useState(false);
  const [lockedFollowersProgress, setLockedFollowersProgress] = useState(0);
  const [lockedFollowersProcessedCount, setLockedFollowersProcessedCount] = useState(0);
  const [lastResultLockedFollowers, setLastResultLockedFollowers] = useState<{
    processedCount: number;
    totalFollowersAdded: number;
    completedAt: string;
  } | null>(null);
  
  // 안잠긴 엔트리 랜덤 투표/조회수 추가 상태 (100-200)
  const [unlockedEntryCount, setUnlockedEntryCount] = useState<number>(0);
  const [isAddingToUnlocked, setIsAddingToUnlocked] = useState(false);
  const [unlockedProgress, setUnlockedProgress] = useState(0);
  const [unlockedProcessedCount, setUnlockedProcessedCount] = useState(0);
  const [lastResultUnlocked, setLastResultUnlocked] = useState<{
    processedCount: number;
    totalVotesAdded: number;
    totalViewsAdded: number;
    completedAt: string;
  } | null>(null);
  
  // 투표수가 0인 엔트리에만 랜덤 투표 추가 상태
  const [zeroVoteEntryCount, setZeroVoteEntryCount] = useState<number>(0);
  const [isAddingToZeroVotes, setIsAddingToZeroVotes] = useState(false);
  const [zeroVotesProgress, setZeroVotesProgress] = useState(0);
  const [zeroVotesProcessedCount, setZeroVotesProcessedCount] = useState(0);
  const [lastResultZeroVotes, setLastResultZeroVotes] = useState<{
    processedCount: number;
    totalVotesAdded: number;
    completedAt: string;
  } | null>(null);

  // 잠긴 엔트리 수 가져오기
  useEffect(() => {
    const fetchEntryCounts = async () => {
      // 잠긴 엔트리 수
      const { count: lockedCount, error: lockedError } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")');
      
      if (!lockedError && lockedCount !== null) {
        setLockedEntryCount(lockedCount);
      }
      
      // 안잠긴 엔트리 수
      const { count: unlockedCount, error: unlockedError } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .in("page_status", ['claimed', 'verified']);
      
      if (!unlockedError && unlockedCount !== null) {
        setUnlockedEntryCount(unlockedCount);
      }
      
      // 투표수가 0인 잠긴 엔트리 수
      const { count: zeroVoteCount, error: zeroVoteError } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")')
        .eq("votes", 0);
      
      if (!zeroVoteError && zeroVoteCount !== null) {
        setZeroVoteEntryCount(zeroVoteCount);
      }
    };
    fetchEntryCounts();
  }, []);

  // 잠긴 엔트리들에 랜덤 투표 추가 (배치 처리)
  const handleAddRandomVotesToLockedEntries = async () => {
    if (isAddingRandomVotes) return;
    
    const confirmed = window.confirm(
      `${lockedEntryCount}개의 잠긴 엔트리에 100-200 사이의 랜덤 투표를 추가하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsAddingRandomVotes(true);
    setRandomVoteProgress(0);
    setProcessedCount(0);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalVotesAdded = 0;
    let lastProcessedId: string | null = null;

    try {
      while (true) {
        // 배치로 잠긴 엔트리 가져오기 (ID 순서로 정렬하여 일관성 보장)
        let query = supabase
          .from("wiki_entries")
          .select("id, votes, aggregated_votes, view_count, follower_count")
          .not("page_status", "in", '("claimed","verified")')
          .order("id", { ascending: true })
          .limit(BATCH_SIZE);
        
        // 마지막 처리된 ID 이후부터 가져오기
        if (lastProcessedId) {
          query = query.gt("id", lastProcessedId);
        }

        const { data: entries, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!entries || entries.length === 0) break;

        // 각 엔트리에 랜덤 투표 추가
        for (const entry of entries) {
          const randomVotes = Math.floor(Math.random() * 101) + 100; // 100-200
          const newVotes = entry.votes + randomVotes;
          const newAggregatedVotes = (entry.aggregated_votes || entry.votes) + randomVotes;
          
          // 트렌딩 스코어 재계산: (upvotes × 8) + (views × 1) + (followers × 10)
          const newTrendingScore = 
            (newVotes * 8) + 
            (entry.view_count * 1) + 
            (entry.follower_count * 10);
          
          const newAggregatedTrendingScore = 
            (newAggregatedVotes * 8) + 
            (entry.view_count * 1) + 
            (entry.follower_count * 10);

          const { error: updateError } = await supabase
            .from("wiki_entries")
            .update({
              votes: newVotes,
              aggregated_votes: newAggregatedVotes,
              trending_score: newTrendingScore,
              aggregated_trending_score: newAggregatedTrendingScore,
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            totalVotesAdded += randomVotes;
          }

          totalProcessed++;
          lastProcessedId = entry.id; // 마지막 처리된 ID 업데이트
          setProcessedCount(totalProcessed);
          setRandomVoteProgress((totalProcessed / lockedEntryCount) * 100);
        }
        
        // 다음 배치가 없으면 종료
        if (entries.length < BATCH_SIZE) break;
      }

      // 결과 기록
      setLastResult1({
        processedCount: totalProcessed,
        totalVotesAdded,
        completedAt: new Date().toLocaleString('ko-KR'),
      });

      toast({
        title: "Random Votes Added",
        description: `${totalProcessed}개의 엔트리에 총 ${totalVotesAdded.toLocaleString()}표가 추가되었습니다.`,
      });

      // 잠긴 엔트리 수 다시 가져오기
      const { count } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")');
      if (count !== null) setLockedEntryCount(count);

    } catch (error) {
      console.error("Error adding random votes:", error);
      toast({
        title: "Error",
        description: "랜덤 투표 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingRandomVotes(false);
      setRandomVoteProgress(0);
      setProcessedCount(0);
    }
  };

  // 투표수가 0인 엔트리들에만 랜덤 투표 추가 (100-200)
  const handleAddRandomVotesToZeroVotesEntries = async () => {
    if (isAddingToZeroVotes) return;
    
    const confirmed = window.confirm(
      `투표수가 0인 ${zeroVoteEntryCount}개의 엔트리에 100-200 사이의 랜덤 투표를 추가하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsAddingToZeroVotes(true);
    setZeroVotesProgress(0);
    setZeroVotesProcessedCount(0);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalVotesAdded = 0;
    let lastProcessedId: string | null = null;

    try {
      while (true) {
        let query = supabase
          .from("wiki_entries")
          .select("id, votes, aggregated_votes, view_count, follower_count")
          .not("page_status", "in", '("claimed","verified")')
          .eq("votes", 0)
          .order("id", { ascending: true })
          .limit(BATCH_SIZE);
        
        if (lastProcessedId) {
          query = query.gt("id", lastProcessedId);
        }

        const { data: entries, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!entries || entries.length === 0) break;

        for (const entry of entries) {
          const randomVotes = Math.floor(Math.random() * 101) + 100; // 100-200
          const newVotes = entry.votes + randomVotes;
          const newAggregatedVotes = (entry.aggregated_votes || entry.votes) + randomVotes;
          
          const newTrendingScore = 
            (newVotes * 8) + 
            (entry.view_count * 1) + 
            (entry.follower_count * 10);
          
          const newAggregatedTrendingScore = 
            (newAggregatedVotes * 8) + 
            (entry.view_count * 1) + 
            (entry.follower_count * 10);

          const { error: updateError } = await supabase
            .from("wiki_entries")
            .update({
              votes: newVotes,
              aggregated_votes: newAggregatedVotes,
              trending_score: newTrendingScore,
              aggregated_trending_score: newAggregatedTrendingScore,
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            totalVotesAdded += randomVotes;
          }

          totalProcessed++;
          lastProcessedId = entry.id;
          setZeroVotesProcessedCount(totalProcessed);
          setZeroVotesProgress((totalProcessed / zeroVoteEntryCount) * 100);
        }
        
        if (entries.length < BATCH_SIZE) break;
      }

      setLastResultZeroVotes({
        processedCount: totalProcessed,
        totalVotesAdded,
        completedAt: new Date().toLocaleString('ko-KR'),
      });

      toast({
        title: "Random Votes Added to Zero-Vote Entries",
        description: `${totalProcessed}개의 엔트리에 총 ${totalVotesAdded.toLocaleString()}표가 추가되었습니다.`,
      });

      // 투표수가 0인 엔트리 수 다시 가져오기
      const { count } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")')
        .eq("votes", 0);
      if (count !== null) setZeroVoteEntryCount(count);

    } catch (error) {
      console.error("Error adding random votes to zero-vote entries:", error);
      toast({
        title: "Error",
        description: "랜덤 투표 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingToZeroVotes(false);
      setZeroVotesProgress(0);
      setZeroVotesProcessedCount(0);
    }
  };

  // 잠긴 엔트리들에 랜덤 투표/조회수 추가 2 (8-60, 배치 처리)
  const handleAddRandomVotesToLockedEntries2 = async () => {
    if (isAddingRandomVotes2) return;
    
    const confirmed = window.confirm(
      `${lockedEntryCount}개의 잠긴 엔트리에 8-60 사이의 랜덤 투표수와 조회수를 추가하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsAddingRandomVotes2(true);
    setRandomVoteProgress2(0);
    setProcessedCount2(0);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalVotesAdded = 0;
    let totalViewsAdded = 0;
    let lastProcessedId: string | null = null;

    try {
      while (true) {
        // 배치로 잠긴 엔트리 가져오기 (ID 순서로 정렬하여 일관성 보장)
        let query = supabase
          .from("wiki_entries")
          .select("id, votes, aggregated_votes, view_count, follower_count")
          .not("page_status", "in", '("claimed","verified")')
          .order("id", { ascending: true })
          .limit(BATCH_SIZE);
        
        // 마지막 처리된 ID 이후부터 가져오기
        if (lastProcessedId) {
          query = query.gt("id", lastProcessedId);
        }

        const { data: entries, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!entries || entries.length === 0) break;

        // 각 엔트리에 랜덤 투표/조회수 추가
        for (const entry of entries) {
          const randomVotes = Math.floor(Math.random() * 53) + 8; // 8-60
          const randomViews = Math.floor(Math.random() * 53) + 8; // 8-60
          const newVotes = entry.votes + randomVotes;
          const newViews = entry.view_count + randomViews;
          const newAggregatedVotes = (entry.aggregated_votes || entry.votes) + randomVotes;
          
          // 트렌딩 스코어 재계산: (upvotes × 8) + (views × 1) + (followers × 10)
          const newTrendingScore = 
            (newVotes * 8) + 
            (newViews * 1) + 
            (entry.follower_count * 10);
          
          const newAggregatedTrendingScore = 
            (newAggregatedVotes * 8) + 
            (newViews * 1) + 
            (entry.follower_count * 10);

          const { error: updateError } = await supabase
            .from("wiki_entries")
            .update({
              votes: newVotes,
              view_count: newViews,
              aggregated_votes: newAggregatedVotes,
              trending_score: newTrendingScore,
              aggregated_trending_score: newAggregatedTrendingScore,
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            totalVotesAdded += randomVotes;
            totalViewsAdded += randomViews;
          }

          totalProcessed++;
          lastProcessedId = entry.id;
          setProcessedCount2(totalProcessed);
          setRandomVoteProgress2((totalProcessed / lockedEntryCount) * 100);
        }
        
        // 다음 배치가 없으면 종료
        if (entries.length < BATCH_SIZE) break;
      }

      // 결과 기록
      setLastResult2({
        processedCount: totalProcessed,
        totalVotesAdded,
        totalViewsAdded,
        completedAt: new Date().toLocaleString('ko-KR'),
      });

      toast({
        title: "Random Votes & Views Added (8-60)",
        description: `${totalProcessed}개의 엔트리에 총 ${totalVotesAdded.toLocaleString()}표, ${totalViewsAdded.toLocaleString()}조회수가 추가되었습니다.`,
      });

      // 잠긴 엔트리 수 다시 가져오기
      const { count } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")');
      if (count !== null) setLockedEntryCount(count);

    } catch (error) {
      console.error("Error adding random votes/views:", error);
      toast({
        title: "Error",
        description: "랜덤 투표/조회수 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingRandomVotes2(false);
      setRandomVoteProgress2(0);
      setProcessedCount2(0);
    }
  };

  // 잠긴 엔트리들에 랜덤 조회수만 추가 (100-200, 배치 처리)
  const handleAddRandomViewsToLockedEntries = async () => {
    if (isAddingLockedViews) return;
    
    const confirmed = window.confirm(
      `${lockedEntryCount}개의 잠긴 엔트리에 100-200 사이의 랜덤 조회수를 추가하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsAddingLockedViews(true);
    setLockedViewsProgress(0);
    setLockedViewsProcessedCount(0);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalViewsAdded = 0;
    let lastProcessedId: string | null = null;

    try {
      while (true) {
        let query = supabase
          .from("wiki_entries")
          .select("id, votes, aggregated_votes, view_count, follower_count")
          .not("page_status", "in", '("claimed","verified")')
          .order("id", { ascending: true })
          .limit(BATCH_SIZE);
        
        if (lastProcessedId) {
          query = query.gt("id", lastProcessedId);
        }

        const { data: entries, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!entries || entries.length === 0) break;

        for (const entry of entries) {
          const randomViews = Math.floor(Math.random() * 101) + 100; // 100-200
          const newViews = entry.view_count + randomViews;
          
          // 트렌딩 스코어 재계산: (upvotes × 8) + (views × 1) + (followers × 10)
          const newTrendingScore = 
            (entry.votes * 8) + 
            (newViews * 1) + 
            (entry.follower_count * 10);
          
          const newAggregatedTrendingScore = 
            ((entry.aggregated_votes || entry.votes) * 8) + 
            (newViews * 1) + 
            (entry.follower_count * 10);

          const { error: updateError } = await supabase
            .from("wiki_entries")
            .update({
              view_count: newViews,
              trending_score: newTrendingScore,
              aggregated_trending_score: newAggregatedTrendingScore,
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            totalViewsAdded += randomViews;
          }

          totalProcessed++;
          lastProcessedId = entry.id;
          setLockedViewsProcessedCount(totalProcessed);
          setLockedViewsProgress((totalProcessed / lockedEntryCount) * 100);
        }
        
        if (entries.length < BATCH_SIZE) break;
      }

      setLastResultLockedViews({
        processedCount: totalProcessed,
        totalViewsAdded,
        completedAt: new Date().toLocaleString('ko-KR'),
      });

      toast({
        title: "Random Views Added to Locked Entries",
        description: `${totalProcessed}개의 엔트리에 총 ${totalViewsAdded.toLocaleString()}조회수가 추가되었습니다.`,
      });

      const { count } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")');
      if (count !== null) setLockedEntryCount(count);

    } catch (error) {
      console.error("Error adding random views:", error);
      toast({
        title: "Error",
        description: "랜덤 조회수 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingLockedViews(false);
      setLockedViewsProgress(0);
      setLockedViewsProcessedCount(0);
    }
  };

  // 잠긴 엔트리들에 랜덤 팔로워 추가 (6-88, 배치 처리)
  const handleAddRandomFollowersToLockedEntries = async () => {
    if (isAddingLockedFollowers) return;
    
    const confirmed = window.confirm(
      `${lockedEntryCount}개의 잠긴 엔트리에 6-88 사이의 랜덤 팔로워를 추가하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsAddingLockedFollowers(true);
    setLockedFollowersProgress(0);
    setLockedFollowersProcessedCount(0);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalFollowersAdded = 0;
    let lastProcessedId: string | null = null;

    try {
      while (true) {
        let query = supabase
          .from("wiki_entries")
          .select("id, votes, aggregated_votes, view_count, follower_count")
          .not("page_status", "in", '("claimed","verified")')
          .order("id", { ascending: true })
          .limit(BATCH_SIZE);
        
        if (lastProcessedId) {
          query = query.gt("id", lastProcessedId);
        }

        const { data: entries, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!entries || entries.length === 0) break;

        for (const entry of entries) {
          const randomFollowers = Math.floor(Math.random() * 83) + 6; // 6-88
          const newFollowers = entry.follower_count + randomFollowers;
          
          // 트렌딩 스코어 재계산: (upvotes × 8) + (views × 1) + (followers × 10)
          const newTrendingScore = 
            (entry.votes * 8) + 
            (entry.view_count * 1) + 
            (newFollowers * 10);
          
          const newAggregatedTrendingScore = 
            ((entry.aggregated_votes || entry.votes) * 8) + 
            (entry.view_count * 1) + 
            (newFollowers * 10);

          const { error: updateError } = await supabase
            .from("wiki_entries")
            .update({
              follower_count: newFollowers,
              trending_score: newTrendingScore,
              aggregated_trending_score: newAggregatedTrendingScore,
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            totalFollowersAdded += randomFollowers;
          }

          totalProcessed++;
          lastProcessedId = entry.id;
          setLockedFollowersProcessedCount(totalProcessed);
          setLockedFollowersProgress((totalProcessed / lockedEntryCount) * 100);
        }
        
        if (entries.length < BATCH_SIZE) break;
      }

      setLastResultLockedFollowers({
        processedCount: totalProcessed,
        totalFollowersAdded,
        completedAt: new Date().toLocaleString('ko-KR'),
      });

      toast({
        title: "Random Followers Added to Locked Entries",
        description: `${totalProcessed}개의 엔트리에 총 ${totalFollowersAdded.toLocaleString()}팔로워가 추가되었습니다.`,
      });

      const { count } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .not("page_status", "in", '("claimed","verified")');
      if (count !== null) setLockedEntryCount(count);

    } catch (error) {
      console.error("Error adding random followers:", error);
      toast({
        title: "Error",
        description: "랜덤 팔로워 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingLockedFollowers(false);
      setLockedFollowersProgress(0);
      setLockedFollowersProcessedCount(0);
    }
  };

  // 안잠긴 엔트리들에 랜덤 투표/조회수 추가 (100-200, 배치 처리)
  const handleAddToUnlockedEntries = async () => {
    if (isAddingToUnlocked) return;
    
    const confirmed = window.confirm(
      `${unlockedEntryCount}개의 안잠긴 엔트리에 100-200 사이의 랜덤 투표수와 조회수를 추가하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsAddingToUnlocked(true);
    setUnlockedProgress(0);
    setUnlockedProcessedCount(0);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalVotesAdded = 0;
    let totalViewsAdded = 0;
    let lastProcessedId: string | null = null;

    try {
      while (true) {
        // 배치로 안잠긴 엔트리 가져오기
        let query = supabase
          .from("wiki_entries")
          .select("id, votes, aggregated_votes, view_count, follower_count")
          .in("page_status", ['claimed', 'verified'])
          .order("id", { ascending: true })
          .limit(BATCH_SIZE);
        
        if (lastProcessedId) {
          query = query.gt("id", lastProcessedId);
        }

        const { data: entries, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!entries || entries.length === 0) break;

        // 각 엔트리에 랜덤 투표/조회수 추가
        for (const entry of entries) {
          const randomVotes = Math.floor(Math.random() * 101) + 100; // 100-200
          const randomViews = Math.floor(Math.random() * 101) + 100; // 100-200
          const newVotes = entry.votes + randomVotes;
          const newViews = entry.view_count + randomViews;
          const newAggregatedVotes = (entry.aggregated_votes || entry.votes) + randomVotes;
          
          // 트렌딩 스코어 재계산: (upvotes × 8) + (views × 1) + (followers × 10)
          const newTrendingScore = 
            (newVotes * 8) + 
            (newViews * 1) + 
            (entry.follower_count * 10);
          
          const newAggregatedTrendingScore = 
            (newAggregatedVotes * 8) + 
            (newViews * 1) + 
            (entry.follower_count * 10);

          const { error: updateError } = await supabase
            .from("wiki_entries")
            .update({
              votes: newVotes,
              view_count: newViews,
              aggregated_votes: newAggregatedVotes,
              trending_score: newTrendingScore,
              aggregated_trending_score: newAggregatedTrendingScore,
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`Failed to update entry ${entry.id}:`, updateError);
          } else {
            totalVotesAdded += randomVotes;
            totalViewsAdded += randomViews;
          }

          totalProcessed++;
          lastProcessedId = entry.id;
          setUnlockedProcessedCount(totalProcessed);
          setUnlockedProgress((totalProcessed / unlockedEntryCount) * 100);
        }
        
        if (entries.length < BATCH_SIZE) break;
      }

      setLastResultUnlocked({
        processedCount: totalProcessed,
        totalVotesAdded,
        totalViewsAdded,
        completedAt: new Date().toLocaleString('ko-KR'),
      });

      toast({
        title: "Votes & Views Added to Unlocked Entries",
        description: `${totalProcessed}개의 엔트리에 총 ${totalVotesAdded.toLocaleString()}표, ${totalViewsAdded.toLocaleString()}조회수가 추가되었습니다.`,
      });

      // 안잠긴 엔트리 수 다시 가져오기
      const { count } = await supabase
        .from("wiki_entries")
        .select("id", { count: "exact", head: true })
        .in("page_status", ['claimed', 'verified']);
      if (count !== null) setUnlockedEntryCount(count);

    } catch (error) {
      console.error("Error adding votes/views to unlocked entries:", error);
      toast({
        title: "Error",
        description: "랜덤 투표/조회수 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingToUnlocked(false);
      setUnlockedProgress(0);
      setUnlockedProcessedCount(0);
    }
  };

  // 엔트리 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // 전체 DB 대상으로 검색 (limit 제거)
      const { data, error } = await supabase
        .from("wiki_entries")
        .select("id, title, slug, schema_type, image_url, view_count, follower_count, votes, trending_score")
        .ilike("title", `%${searchQuery}%`)
        .order("trending_score", { ascending: false });

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Failed",
        description: "Failed to search entries",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // 엔트리 선택
  const handleSelectEntry = (entry: WikiEntry) => {
    setSelectedEntry(entry);
    setEditValues({
      votes: entry.votes,
      view_count: entry.view_count,
      follower_count: entry.follower_count,
    });
  };

  // 변경사항 저장
  const handleSave = async () => {
    if (!selectedEntry) return;

    setIsSaving(true);
    try {
      // 트렌딩 스코어 재계산: (upvotes × 8) + (views × 1) + (followers × 10)
      const newTrendingScore = 
        (editValues.votes * 8) + 
        (editValues.view_count * 1) + 
        (editValues.follower_count * 10);

      const { error } = await supabase
        .from("wiki_entries")
        .update({
          votes: editValues.votes,
          view_count: editValues.view_count,
          follower_count: editValues.follower_count,
          trending_score: newTrendingScore,
        })
        .eq("id", selectedEntry.id);

      if (error) throw error;

      // 선택된 엔트리 업데이트
      setSelectedEntry({
        ...selectedEntry,
        votes: editValues.votes,
        view_count: editValues.view_count,
        follower_count: editValues.follower_count,
        trending_score: newTrendingScore,
      });

      // 검색 결과도 업데이트
      setSearchResults(searchResults.map(entry =>
        entry.id === selectedEntry.id
          ? { ...entry, votes: editValues.votes, view_count: editValues.view_count, follower_count: editValues.follower_count, trending_score: newTrendingScore }
          : entry
      ));

      toast({
        title: "Saved Successfully",
        description: `Updated ${selectedEntry.title} - New Score: ${newTrendingScore}`,
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save Failed",
        description: "Failed to update entry",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 스키마 타입 한글 변환
  const getSchemaTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      artist: "Artist",
      member: "Member",
      actor: "Actor",
      group: "Group",
      kpop: "K-Pop",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* 검색 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Entry Score Manager
          </CardTitle>
          <CardDescription>
            Search entries and adjust view count, follower count to modify trending scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search entry by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {searchResults.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                    selectedEntry?.id === entry.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
                  }`}
                  onClick={() => handleSelectEntry(entry)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={entry.image_url || undefined} />
                      <AvatarFallback>{entry.title.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {getSchemaTypeLabel(entry.schema_type)}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {entry.view_count.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {entry.follower_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Score</p>
                      <p className="text-lg font-bold text-primary">
                        {entry.trending_score.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 선택된 엔트리 편집 섹션 - 검색 바로 아래에 위치 */}
      {selectedEntry && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={selectedEntry.image_url || undefined} />
                <AvatarFallback>{selectedEntry.title.charAt(0)}</AvatarFallback>
              </Avatar>
              Edit: {selectedEntry.title}
            </CardTitle>
            <CardDescription>
              Current Score: {selectedEntry.trending_score.toLocaleString()} | Votes: {selectedEntry.votes}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="votes" className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" />
                  Votes
                </Label>
                <Input
                  id="votes"
                  type="number"
                  min="0"
                  value={editValues.votes}
                  onChange={(e) =>
                    setEditValues({ ...editValues, votes: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Score contribution: × 8
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="view_count" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  View Count
                </Label>
                <Input
                  id="view_count"
                  type="number"
                  min="0"
                  value={editValues.view_count}
                  onChange={(e) =>
                    setEditValues({ ...editValues, view_count: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Score contribution: × 1
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="follower_count" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Follower Count
                </Label>
                <Input
                  id="follower_count"
                  type="number"
                  min="0"
                  value={editValues.follower_count}
                  onChange={(e) =>
                    setEditValues({ ...editValues, follower_count: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Score contribution: × 10
                </p>
              </div>
            </div>

            {/* 예상 점수 계산 */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Entry Score Preview <span className="text-xs text-muted-foreground">(자체 점수, 하위 엔트리 제외)</span></p>
              {(() => {
                const votesScore = editValues.votes * 8;
                const viewsScore = editValues.view_count;
                const followersScore = editValues.follower_count * 10;
                const newTotal = votesScore + viewsScore + followersScore;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Votes:</span>{" "}
                      <span className="font-medium">{editValues.votes} × 8 = {votesScore.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Views:</span>{" "}
                      <span className="font-medium">{editValues.view_count.toLocaleString()} × 1 = {viewsScore.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Followers:</span>{" "}
                      <span className="font-medium">{editValues.follower_count} × 10 = {followersScore.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-bold text-primary">
                        {newTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-2">
                * 랭킹 카드에 표시되는 점수는 aggregated_trending_score (하위 엔트리 점수 포함)입니다.
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 잠긴 엔트리 랜덤 투표 추가 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Add Random Votes to Locked Entries
          </CardTitle>
          <CardDescription>
            잠긴 엔트리(claimed/verified 아닌)에 100-200 사이의 랜덤 투표를 추가합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">잠긴 엔트리 수</p>
              <p className="text-2xl font-bold">{lockedEntryCount.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleAddRandomVotesToLockedEntries}
              disabled={isAddingRandomVotes || lockedEntryCount === 0}
              className="gap-2"
            >
              {isAddingRandomVotes ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Add Random Votes (100-200)
                </>
              )}
            </Button>
          </div>

          {isAddingRandomVotes && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 상황</span>
                <span>{processedCount.toLocaleString()} / {lockedEntryCount.toLocaleString()}</span>
              </div>
              <Progress value={randomVoteProgress} className="h-2" />
            </div>
          )}

          {lastResult1 && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">마지막 작업 결과</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">처리된 엔트리</p>
                  <p className="font-bold">{lastResult1.processedCount.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 투표</p>
                  <p className="font-bold">{lastResult1.totalVotesAdded.toLocaleString()}표</p>
                </div>
                <div>
                  <p className="text-muted-foreground">완료 시간</p>
                  <p className="font-bold text-xs">{lastResult1.completedAt}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 투표수가 0인 엔트리에만 랜덤 투표 추가 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="w-5 h-5" />
            Add Random Votes to Zero-Vote Entries Only
          </CardTitle>
          <CardDescription>
            투표수가 0인 엔트리에만 100-200 사이의 랜덤 투표를 추가합니다 (기존 투표가 있는 엔트리는 건드리지 않음)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">투표수 0인 엔트리 수</p>
              <p className="text-2xl font-bold text-orange-500">{zeroVoteEntryCount.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleAddRandomVotesToZeroVotesEntries}
              disabled={isAddingToZeroVotes || zeroVoteEntryCount === 0}
              className="gap-2"
            >
              {isAddingToZeroVotes ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  Add Votes to Zero-Vote Only (100-200)
                </>
              )}
            </Button>
          </div>

          {isAddingToZeroVotes && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 상황</span>
                <span>{zeroVotesProcessedCount.toLocaleString()} / {zeroVoteEntryCount.toLocaleString()}</span>
              </div>
              <Progress value={zeroVotesProgress} className="h-2" />
            </div>
          )}

          {lastResultZeroVotes && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">마지막 작업 결과</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">처리된 엔트리</p>
                  <p className="font-bold">{lastResultZeroVotes.processedCount.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 투표</p>
                  <p className="font-bold">{lastResultZeroVotes.totalVotesAdded.toLocaleString()}표</p>
                </div>
                <div>
                  <p className="text-muted-foreground">완료 시간</p>
                  <p className="font-bold text-xs">{lastResultZeroVotes.completedAt}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 잠긴 엔트리 랜덤 조회수 추가 섹션 (100-200) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Add Random Views to Locked Entries
          </CardTitle>
          <CardDescription>
            잠긴 엔트리(claimed/verified 아닌)에 100-200 사이의 랜덤 조회수를 추가합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">잠긴 엔트리 수</p>
              <p className="text-2xl font-bold">{lockedEntryCount.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleAddRandomViewsToLockedEntries}
              disabled={isAddingLockedViews || lockedEntryCount === 0}
              className="gap-2"
            >
              {isAddingLockedViews ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Add Random Views (100-200)
                </>
              )}
            </Button>
          </div>

          {isAddingLockedViews && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 상황</span>
                <span>{lockedViewsProcessedCount.toLocaleString()} / {lockedEntryCount.toLocaleString()}</span>
              </div>
              <Progress value={lockedViewsProgress} className="h-2" />
            </div>
          )}

          {lastResultLockedViews && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">마지막 작업 결과</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">처리된 엔트리</p>
                  <p className="font-bold">{lastResultLockedViews.processedCount.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 조회수</p>
                  <p className="font-bold">{lastResultLockedViews.totalViewsAdded.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">완료 시간</p>
                  <p className="font-bold text-xs">{lastResultLockedViews.completedAt}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 잠긴 엔트리 랜덤 팔로워 추가 섹션 (6-88) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Add Random Followers to Locked Entries
          </CardTitle>
          <CardDescription>
            잠긴 엔트리(claimed/verified 아닌)에 6-88 사이의 랜덤 팔로워를 추가합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">잠긴 엔트리 수</p>
              <p className="text-2xl font-bold">{lockedEntryCount.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleAddRandomFollowersToLockedEntries}
              disabled={isAddingLockedFollowers || lockedEntryCount === 0}
              className="gap-2"
            >
              {isAddingLockedFollowers ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Add Random Followers (6-88)
                </>
              )}
            </Button>
          </div>

          {isAddingLockedFollowers && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 상황</span>
                <span>{lockedFollowersProcessedCount.toLocaleString()} / {lockedEntryCount.toLocaleString()}</span>
              </div>
              <Progress value={lockedFollowersProgress} className="h-2" />
            </div>
          )}

          {lastResultLockedFollowers && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">마지막 작업 결과</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">처리된 엔트리</p>
                  <p className="font-bold">{lastResultLockedFollowers.processedCount.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 팔로워</p>
                  <p className="font-bold">{lastResultLockedFollowers.totalFollowersAdded.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">완료 시간</p>
                  <p className="font-bold text-xs">{lastResultLockedFollowers.completedAt}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 잠긴 엔트리 랜덤 투표/조회수 추가 섹션 2 (8-60) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Add Random Votes & Views to Locked Entries 2
          </CardTitle>
          <CardDescription>
            잠긴 엔트리(claimed/verified 아닌)에 8-60 사이의 랜덤 투표수와 조회수를 추가합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">잠긴 엔트리 수</p>
              <p className="text-2xl font-bold">{lockedEntryCount.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleAddRandomVotesToLockedEntries2}
              disabled={isAddingRandomVotes2 || lockedEntryCount === 0}
              className="gap-2"
            >
              {isAddingRandomVotes2 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Add Votes & Views (8-60)
                </>
              )}
            </Button>
          </div>

          {isAddingRandomVotes2 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 상황</span>
                <span>{processedCount2.toLocaleString()} / {lockedEntryCount.toLocaleString()}</span>
              </div>
              <Progress value={randomVoteProgress2} className="h-2" />
            </div>
          )}

          {lastResult2 && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">마지막 작업 결과</p>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">처리된 엔트리</p>
                  <p className="font-bold">{lastResult2.processedCount.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 투표</p>
                  <p className="font-bold">{lastResult2.totalVotesAdded.toLocaleString()}표</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 조회수</p>
                  <p className="font-bold">{lastResult2.totalViewsAdded.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">완료 시간</p>
                  <p className="font-bold text-xs">{lastResult2.completedAt}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 안잠긴 엔트리 랜덤 투표/조회수 추가 섹션 (100-200) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="w-5 h-5" />
            Add Random Votes & Views to Unlocked Entries
          </CardTitle>
          <CardDescription>
            안잠긴 엔트리(claimed/verified)에 100-200 사이의 랜덤 투표수와 조회수를 추가합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">안잠긴 엔트리 수</p>
              <p className="text-2xl font-bold">{unlockedEntryCount.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleAddToUnlockedEntries}
              disabled={isAddingToUnlocked || unlockedEntryCount === 0}
              className="gap-2"
            >
              {isAddingToUnlocked ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Add Votes & Views (100-200)
                </>
              )}
            </Button>
          </div>

          {isAddingToUnlocked && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 상황</span>
                <span>{unlockedProcessedCount.toLocaleString()} / {unlockedEntryCount.toLocaleString()}</span>
              </div>
              <Progress value={unlockedProgress} className="h-2" />
            </div>
          )}

          {lastResultUnlocked && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">마지막 작업 결과</p>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">처리된 엔트리</p>
                  <p className="font-bold">{lastResultUnlocked.processedCount.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 투표</p>
                  <p className="font-bold">{lastResultUnlocked.totalVotesAdded.toLocaleString()}표</p>
                </div>
                <div>
                  <p className="text-muted-foreground">추가된 총 조회수</p>
                  <p className="font-bold">{lastResultUnlocked.totalViewsAdded.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">완료 시간</p>
                  <p className="font-bold text-xs">{lastResultUnlocked.completedAt}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
