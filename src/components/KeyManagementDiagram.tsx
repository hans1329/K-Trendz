import { ArrowRight, Database, Key, Lock, Shield } from "lucide-react";

export const KeyManagementDiagram = () => {
  return (
    <div className="bg-background/50 p-6 rounded-xl mb-6 border border-border overflow-x-auto">
      <div className="min-w-[600px]">
        {/* User Wallet Generation Flow */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold mb-4 text-foreground">User Wallet Generation Flow</h4>
          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg flex-1">
                <Database className="w-5 h-5 text-primary" />
                <span className="text-foreground">User Registration</span>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg flex-1">
                <span className="text-foreground font-mono">Supabase UUID</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg flex-1">
                <span className="text-foreground">Backend Request</span>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-lg flex-1 border-2 border-orange-500/50">
                <Key className="w-5 h-5 text-orange-500" />
                <span className="text-foreground font-semibold">AWS KMS</span>
              </div>
            </div>

            {/* Step 3 - Split into two paths */}
            <div className="pl-8 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-lg flex-1 border-2 border-orange-500/50">
                  <Key className="w-5 h-5 text-orange-500" />
                  <span className="text-foreground">KMS Generates Private Key</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-2 bg-green-600/20 px-4 py-2 rounded-lg flex-1 border-2 border-green-600/50">
                  <Lock className="w-5 h-5 text-green-600" />
                  <span className="text-foreground">Encrypted Storage</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-lg flex-1 border-2 border-orange-500/50">
                  <span className="text-foreground">Public Address</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-2 bg-green-600/20 px-4 py-2 rounded-lg flex-1 border-2 border-green-600/50">
                  <Database className="w-5 h-5 text-green-600" />
                  <span className="text-foreground">Stored in Database</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-lg flex-1 border-2 border-orange-500/50">
                  <span className="text-foreground">Token Minting</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg flex-1">
                  <span className="text-foreground">KMS Signs Transactions</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Features */}
        <div className="mt-8 pt-6 border-t border-border">
          <h4 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Security Features
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-2 bg-muted/30 px-4 py-3 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-foreground/90">Keys never leave AWS infrastructure</span>
            </div>
            <div className="flex items-start gap-2 bg-muted/30 px-4 py-3 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-foreground/90">Access logs for all operations</span>
            </div>
            <div className="flex items-start gap-2 bg-muted/30 px-4 py-3 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-foreground/90">Automatic rotation policies</span>
            </div>
            <div className="flex items-start gap-2 bg-muted/30 px-4 py-3 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-foreground/90">Disaster recovery backups</span>
            </div>
            <div className="flex items-start gap-2 bg-muted/30 px-4 py-3 rounded-lg md:col-span-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-foreground/90">Compliance with SOC 2 standards</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
