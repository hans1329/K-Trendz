import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service - KTRENDZ</title>
        <meta name="description" content="Read the terms of service for KTRENDZ, your community platform for trending discussions and insights." />
        <link rel="canonical" href="https://k-trendz.com/terms" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Terms of Service</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">1. Acceptance of Terms</h2>
              <p>By accessing and using KTRENDZ ("the Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use the Service.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">2. Use of Service</h2>
              <p>You must be at least 13 years old to use this Service. You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">3. User Content</h2>
              <p>You retain all rights to the content you post on KTRENDZ. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content in connection with the Service.</p>
              <p className="mt-2">You agree not to post content that:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Is illegal, harmful, threatening, abusive, or discriminatory</li>
                <li>Violates any intellectual property rights</li>
                <li>Contains spam or unsolicited advertising</li>
                <li>Impersonates any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">4. Community Guidelines</h2>
              <p>Users must maintain respectful interactions within the community. We reserve the right to remove content and terminate accounts that violate our community standards.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">5. Intellectual Property</h2>
              <p>The Service and its original content, features, and functionality are owned by KTRENDZ and are protected by international copyright, trademark, and other intellectual property laws.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">6. Disclaimer of Warranties</h2>
              <p>The Service is provided "as is" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, timely, secure, or error-free.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">7. Limitation of Liability</h2>
              <p>KTRENDZ shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">8. Changes to Terms</h2>
              <p>We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Service on this page.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">9. Contact Information</h2>
              <p>If you have any questions about these Terms, please contact us through our platform.</p>
            </section>

            <p className="text-sm mt-8 pt-8 border-t border-border">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default Terms;