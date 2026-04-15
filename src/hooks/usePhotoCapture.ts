import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { isNativeApp } from "@/lib/capacitor";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook for capturing photos and uploading to daily-log-photos bucket.
 * Uses Capacitor Camera on native, file input on web.
 */
export function usePhotoCapture() {
  const { employee } = useMobileAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const captureAndUpload = useCallback(async (projectId: string): Promise<string | null> => {
    if (!employee) return null;
    setUploading(true);

    try {
      let file: File | Blob;
      let fileName: string;

      if (isNativeApp()) {
        const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          width: 1200,
          height: 1200,
        });

        // Convert base64 to blob
        const byteString = atob(photo.base64String!);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const ext = photo.format || "jpeg";
        file = new Blob([ab], { type: `image/${ext}` });
        fileName = `${projectId}/${employee.id}_${Date.now()}.${ext}`;
      } else {
        // Web fallback: use file input
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";

        const selected = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] || null);
          input.click();
        });

        if (!selected) {
          setUploading(false);
          return null;
        }

        file = selected;
        const ext = selected.name.split(".").pop() || "jpg";
        fileName = `${projectId}/${employee.id}_${Date.now()}.${ext}`;
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("daily-log-photos")
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Store the path - signed URLs will be generated when displaying
      return fileName;
    } catch (e: any) {
      console.error("Photo capture failed:", e);
      toast({
        title: "Photo Error",
        description: e?.message || "Failed to capture or upload photo.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [employee, toast]);

  return { captureAndUpload, uploading };
}
