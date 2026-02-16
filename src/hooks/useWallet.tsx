import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WalletAddress {
  wallet_address: string;
  network: string;
  wallet_type?: string;
  created_at: string;
}

export const useWallet = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  // Fetch Smart Wallet address (QuestN 외부지갑(external)과 구분해야 함)
  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet', user?.id, 'smart_wallet'],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('wallet_addresses')
        .select('wallet_address, network, wallet_type, created_at')
        .eq('user_id', user.id)
        .eq('wallet_type', 'smart_wallet')
        .maybeSingle();

      if (error) {
        console.error('Error fetching smart wallet:', error);
        return null;
      }

      return data as WalletAddress | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5분간 캐시
  });

  // Create wallet mutation
  const createWalletMutation = useMutation({
    mutationFn: async (options?: { forceRegenerate?: boolean }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('create-smart-wallet', {
        body: {
          forceRegenerate: options?.forceRegenerate ?? false,
        },
      });

      if (error) throw error;
      return data as { message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', user?.id, 'smart_wallet'] });

      // 자동 생성/재방문 시 "already exists" 응답이면 알림을 띄우지 않음
      if (data?.message !== 'Wallet already exists') {
        toast.success('Smart Wallet created successfully!');
      }
    },
    onError: (error) => {
      console.error('Error creating wallet:', error);
      toast.error('Failed to create wallet');
    },
  });

  // Auto-create wallet on first login - 한 번만 실행되도록 ref 사용
  const autoCreateAttemptedRef = useRef(false);
  
  useEffect(() => {
    const autoCreateWallet = async () => {
      // 이미 시도했거나, 생성 중이거나, 지갑이 있으면 스킵
      if (autoCreateAttemptedRef.current || isCreating || createWalletMutation.isPending) {
        return;
      }
      
      if (user && !wallet && !isLoading) {
        console.log('Auto-creating wallet for new user...');
        autoCreateAttemptedRef.current = true; // 한 번만 시도하도록 플래그 설정
        setIsCreating(true);
        try {
          await createWallet();
        } catch (error) {
          console.error('Auto wallet creation failed:', error);
        } finally {
          setIsCreating(false);
        }
      }
    };

    // Small delay to ensure auth is fully settled
    const timeout = setTimeout(autoCreateWallet, 1000);
    return () => clearTimeout(timeout);
  }, [user?.id, wallet, isLoading, isCreating, createWalletMutation.isPending]);

  const createWallet = async (options?: { forceRegenerate?: boolean }) => {
    return createWalletMutation.mutateAsync(options);
  };

  return {
    wallet,
    isLoading: isLoading || isCreating,
    hasWallet: !!wallet,
    createWallet,
    isCreating: createWalletMutation.isPending || isCreating,
  };
};
