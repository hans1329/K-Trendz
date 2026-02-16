import { useEffect } from 'react';

const Sitemap = () => {
  useEffect(() => {
    // Redirect to edge function
    window.location.replace('https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap');
  }, []);

  return null;
};

export default Sitemap;
