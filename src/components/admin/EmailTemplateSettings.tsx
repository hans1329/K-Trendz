import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Send, Eye, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailTemplate {
  subject: string;
  heading: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  footer: string;
}

const defaultTemplate: EmailTemplate = {
  subject: "Welcome to KTRENDZ, {{username}}!",
  heading: "Welcome to KTRENDZ!",
  body: "Hi {{username}},\n\nThank you for joining KTRENDZ! We're excited to have you as part of our community.\n\nStart exploring fan pages, discover your favorite K-pop artists and actors, and connect with fans worldwide.",
  buttonText: "Explore Now",
  buttonUrl: "https://k-trendz.com",
  footer: "Best regards,\nThe KTRENDZ Team",
};

export const EmailTemplateSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [template, setTemplate] = useState<EmailTemplate>(defaultTemplate);
  const [testEmail, setTestEmail] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "welcome_email_template")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data?.setting_value) {
        setTemplate(data.setting_value as unknown as EmailTemplate);
      }
    } catch (error) {
      console.error("Error fetching email template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 먼저 기존 설정이 있는지 확인
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", "welcome_email_template")
        .single();

      let error;
      const templateJson = JSON.parse(JSON.stringify(template));
      
      if (existing) {
        // 업데이트
        const result = await supabase
          .from("system_settings")
          .update({
            setting_value: templateJson,
            description: "Welcome email template for new user signups",
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "welcome_email_template");
        error = result.error;
      } else {
        // 새로 삽입
        const result = await supabase
          .from("system_settings")
          .insert([{
            setting_key: "welcome_email_template",
            setting_value: templateJson,
            description: "Welcome email template for new user signups",
          }]);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Email template has been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save email template.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter a test email address.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      // 먼저 템플릿 저장
      await handleSave();

      const { error } = await supabase.functions.invoke("send-welcome-email", {
        body: {
          to: testEmail,
          username: "TestUser",
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Test email sent to ${testEmail}`,
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test email.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const generatePreviewHtml = () => {
    const processedBody = template.body
      .replace(/\{\{username\}\}/g, "TestUser")
      .replace(/\{\{email\}\}/g, "test@example.com");

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f4; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #c13400 0%, #ff6b35 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">${template.heading}</h1>
          </div>
          <div style="padding: 40px 30px;">
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; white-space: pre-line;">${processedBody}</p>
            ${template.buttonText ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${template.buttonUrl}" style="display: inline-block; background-color: #c13400; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: bold; font-size: 16px;">
                ${template.buttonText}
              </a>
            </div>
            ` : ''}
          </div>
          <div style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0; white-space: pre-line;">${template.footer}</p>
            <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
              © ${new Date().getFullYear()} KTRENDZ. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Welcome Email Template
          </CardTitle>
          <CardDescription>
            Configure the email template that will be sent to new users upon signup.
            Use {"{{username}}"} and {"{{email}}"} as placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={template.subject}
                onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                placeholder="Welcome to KTRENDZ!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heading">Email Heading</Label>
              <Input
                id="heading"
                value={template.heading}
                onChange={(e) => setTemplate({ ...template, heading: e.target.value })}
                placeholder="Welcome to KTRENDZ!"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              value={template.body}
              onChange={(e) => setTemplate({ ...template, body: e.target.value })}
              placeholder="Enter the main content of your email..."
              rows={6}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="buttonText">Button Text (optional)</Label>
              <Input
                id="buttonText"
                value={template.buttonText}
                onChange={(e) => setTemplate({ ...template, buttonText: e.target.value })}
                placeholder="Explore Now"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buttonUrl">Button URL</Label>
              <Input
                id="buttonUrl"
                value={template.buttonUrl}
                onChange={(e) => setTemplate({ ...template, buttonUrl: e.target.value })}
                placeholder="https://k-trendz.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer">Footer Text</Label>
            <Textarea
              id="footer"
              value={template.footer}
              onChange={(e) => setTemplate({ ...template, footer: e.target.value })}
              placeholder="Best regards,\nThe KTRENDZ Team"
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Test Email
          </CardTitle>
          <CardDescription>
            Send a test email to verify your template looks correct.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter test email address"
              className="flex-1"
            />
            <Button
              onClick={handleSendTest}
              disabled={testing || !testEmail}
              className="gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div 
            className="border rounded-lg overflow-hidden"
            dangerouslySetInnerHTML={{ __html: generatePreviewHtml() }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplateSettings;
