import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, Clock, Bell, Shield, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl">
      <Tabs defaultValue="location" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="maps">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" /> Google Maps Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configure your Google Maps API key for location picker and site maps.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Navigation className="h-4 w-4 text-brand" /> GPS & Location Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configure GPS radius, accuracy thresholds, and spoofing detection for offices and project sites.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-brand" /> Attendance Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Set standard work hours, overtime thresholds, travel time rules, and late arrival settings.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4 text-brand" /> Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configure alert channels, escalation delays, and morning briefing schedule.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-brand" /> Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage the permission matrix for Admin, Manager, and Supervisor roles across all modules.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-brand" /> System</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View audit logs, manage backups, and configure system-wide settings.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
