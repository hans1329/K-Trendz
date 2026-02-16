import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Coins } from "lucide-react";
const CreateCommunity = () => {
  const navigate = useNavigate();
  const {
    user,
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiredPoints, setRequiredPoints] = useState(100);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon_url: "",
    banner_url: ""
  });
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    // Fetch required points from point_rules
    const fetchRequiredPoints = async () => {
      const {
        data
      } = await supabase.from('point_rules').select('points').eq('action_type', 'create_custom_community').eq('is_active', true).single();
      if (data) {
        setRequiredPoints(Math.abs(data.points));
      }
    };
    fetchRequiredPoints();
  }, []);

  // Real-time slug availability check
  useEffect(() => {
    if (!formData.slug || formData.slug.length < 2) {
      setSlugAvailable(null);
      return;
    }

    const checkSlugAvailability = async () => {
      setCheckingSlug(true);
      try {
        const { data, error } = await supabase
          .from('communities')
          .select('slug')
          .eq('slug', formData.slug)
          .maybeSingle();

        if (error) throw error;
        setSlugAvailable(!data);
      } catch (error) {
        console.error('Error checking slug:', error);
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    };

    const debounceTimer = setTimeout(checkSlugAvailability, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData.slug]);
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    setFormData({
      ...formData,
      name,
      slug
    });
  };
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `temp/icon-${Date.now()}.${fileExt}`;
    setUploadingIcon(true);
    try {
      const {
        error: uploadError
      } = await supabase.storage.from('community-assets').upload(fileName, file, {
        upsert: true
      });
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('community-assets').getPublicUrl(fileName);
      setFormData({
        ...formData,
        icon_url: publicUrl
      });
      toast({
        title: "Icon uploaded",
        description: "Club icon has been uploaded"
      });
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast({
        title: "Upload error",
        description: "Failed to upload icon",
        variant: "destructive"
      });
    } finally {
      setUploadingIcon(false);
    }
  };
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `temp/banner-${Date.now()}.${fileExt}`;
    setUploadingBanner(true);
    try {
      const {
        error: uploadError
      } = await supabase.storage.from('community-assets').upload(fileName, file, {
        upsert: true
      });
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('community-assets').getPublicUrl(fileName);
      setFormData({
        ...formData,
        banner_url: publicUrl
      });
      toast({
        title: "Banner uploaded",
        description: "Club banner has been uploaded"
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload error",
        description: "Failed to upload banner",
        variant: "destructive"
      });
    } finally {
      setUploadingBanner(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to create a club",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    // Validate required images
    if (!formData.icon_url) {
      toast({
        title: "Icon Required",
        description: "Please upload a club icon",
        variant: "destructive"
      });
      return;
    }

    if (!formData.banner_url) {
      toast({
        title: "Banner Required",
        description: "Please upload a club banner",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const {
        data,
        error
      } = await supabase.from("communities").insert({
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        icon_url: formData.icon_url || null,
        banner_url: formData.banner_url || null,
        creator_id: user.id
      }).select().single();
      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Club already exists",
            description: "A club with this name already exists",
            variant: "destructive"
          });
        } else if (error.message?.includes("Insufficient points")) {
          toast({
            title: "Insufficient Stars",
            description: `You need ${requiredPoints} points to create a club. You have ${profile?.available_points || 0} points.`,
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      // Auto-join the creator
      await supabase.from("community_members").insert({
        community_id: data.id,
        user_id: user.id
      });
      toast({
        title: "Club created!",
        description: `Successfully created /c/${formData.slug}`
      });
      navigate(`/c/${data.slug}`);
    } catch (error) {
      console.error("Error creating community:", error);
      toast({
        title: "Error",
        description: "Failed to create club. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Create a Club
              </h1>
              <p className="text-muted-foreground">
                Build and grow a club around your interests
              </p>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
              <Coins className="w-5 h-5 text-primary" />
              <div className="text-sm">
                <div className="font-semibold text-primary">Cost: {requiredPoints} Points</div>
                <div className="text-muted-foreground">You have: {profile?.available_points || 0}</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Club Name *</Label>
              <Input id="name" value={formData.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g., K-Pop News" required maxLength={50} />
              <p className="text-sm text-muted-foreground">
                URL: /c/{formData.slug || "your-club"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Club URL *</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">c/</span>
                <Input id="slug" value={formData.slug} onChange={e => setFormData({
                ...formData,
                slug: e.target.value
              })} placeholder="kpop-news" required pattern="[a-z0-9-]+" maxLength={30} className={
                slugAvailable === false ? "border-destructive" : 
                slugAvailable === true ? "border-green-500" : ""
              } />
              </div>
              {checkingSlug && (
                <p className="text-xs text-muted-foreground">
                  Checking availability...
                </p>
              )}
              {!checkingSlug && slugAvailable === true && (
                <p className="text-xs text-green-500">
                  ✓ This URL is available
                </p>
              )}
              {!checkingSlug && slugAvailable === false && (
                <p className="text-xs text-destructive">
                  ✗ This URL is already taken
                </p>
              )}
              {!checkingSlug && slugAvailable === null && (
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={e => setFormData({
              ...formData,
              description: e.target.value
            })} placeholder="Tell people what your community is about..." rows={4} maxLength={500} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon_file">Club Icon *</Label>
              <div className="flex items-center gap-4">
                {formData.icon_url && <img src={formData.icon_url} alt="Icon preview" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover" />}
                <div className="flex-1">
                  <Input id="icon_file" type="file" accept="image/*" onChange={handleIconUpload} disabled={uploadingIcon || isSubmitting} className="hidden" />
                  <Label htmlFor="icon_file" className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 w-full sm:w-auto bg-background text-primary rounded-full hover:bg-primary/10 transition-colors text-xs sm:text-sm">
                    <Upload className="h-4 w-4" />
                    {uploadingIcon ? "Uploading..." : "Upload Icon"}
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner_file">Club Banner *</Label>
              <div className="flex flex-col gap-4">
                {formData.banner_url && <img src={formData.banner_url} alt="Banner preview" className="w-full h-24 sm:h-32 rounded-lg object-cover" />}
                <div>
                  <Input id="banner_file" type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner || isSubmitting} className="hidden" />
                  <Label htmlFor="banner_file" className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 w-full sm:w-auto bg-background text-primary rounded-full hover:bg-primary/10 transition-colors text-xs sm:text-sm">
                    <Upload className="h-4 w-4" />
                    {uploadingBanner ? "Uploading..." : "Upload Banner"}
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                className="w-full sm:flex-1 order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || slugAvailable === false || checkingSlug} 
                className="w-full sm:flex-1 order-1 sm:order-2"
              >
                {isSubmitting ? "Creating..." : "Create Club"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>;
};
export default CreateCommunity;