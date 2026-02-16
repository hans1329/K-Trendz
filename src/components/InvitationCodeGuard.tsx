import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { InvitationCodeModal } from './InvitationCodeModal';

interface InvitationCodeGuardProps {
  children: React.ReactNode;
}

export const InvitationCodeGuard = ({ children }: InvitationCodeGuardProps) => {
  // 초대코드 로직 임시 비활성화 (2024-12)
  // TODO: 나중에 다시 활성화할 때 아래 주석 해제
  return <>{children}</>;
  
  /* 
  const { user, loading: authLoading } = useAuth();
  const [needsInvitation, setNeedsInvitation] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    checkInvitationStatus();
  }, [user?.id]);

  const checkInvitationStatus = async () => {
    if (!user?.id) {
      setChecking(false);
      setNeedsInvitation(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('invitation_verified, display_name, username')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // 유저명 설정
      setUsername(data?.display_name || data?.username || 'User');
      // 초대 확인이 안 된 경우 모달 표시
      setNeedsInvitation(!data?.invitation_verified);
    } catch (error) {
      console.error('Error checking invitation status:', error);
      setNeedsInvitation(false);
    } finally {
      setChecking(false);
    }
  };

  const handleInvitationSuccess = () => {
    setNeedsInvitation(false);
    // 프로필 쿼리 무효화
    window.location.reload();
  };

  // 인증 로딩 중이거나 초대 확인 중
  if (authLoading || checking) {
    return <>{children}</>;
  }

  return (
    <>
      {needsInvitation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" />
      )}
      
      <InvitationCodeModal 
        open={needsInvitation} 
        onSuccess={handleInvitationSuccess}
        username={username}
      />
      
      {children}
    </>
  );
  */
};
