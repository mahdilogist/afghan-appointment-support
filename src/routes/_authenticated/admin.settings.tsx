import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SetupGuide } from "@/components/setup-guide";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/admin-queries";
import { useI18n } from "@/lib/i18n";
import { errorKeyFor, type QueueOrder } from "@/lib/request-rules";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const RETENTION_OPTIONS = ["unset", "90", "180", "365"] as const;

function SettingsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [policy, setPolicy] = useState<"unset" | "single_admin" | "two_person">("unset");
  const [order, setOrder] = useState<QueueOrder>("oldest_first");
  const [retention, setRetention] = useState<string>("unset");

  useEffect(() => {
    if (!settings.data) return;
    setPolicy(settings.data.approval_policy ?? "unset");
    setOrder(settings.data.queue_order);
    setRetention(settings.data.retention_days ? String(settings.data.retention_days) : "unset");
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_settings", {
        p_approval_policy: policy === "unset" ? "" : policy,
        p_queue_order: order,
        p_retention_days: retention === "unset" ? (null as unknown as number) : Number(retention),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(t(errorKeyFor(e))),
  });

  if (settings.isPending) return <p className="text-muted-foreground">{t("adminLoading")}</p>;

  const card = "rounded-3xl border border-border bg-card p-6 shadow-soft";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("settingsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("settingsIntro")}</p>
      </div>

      <section className={card}>
        <h2 className="font-semibold">{t("settingsApprovalTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsApprovalBody")}</p>
        <Select value={policy} onValueChange={(v) => setPolicy(v as typeof policy)}>
          <SelectTrigger className="mt-3 sm:w-80" aria-label={t("settingsApprovalTitle")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">{t("policyUnset")}</SelectItem>
            <SelectItem value="single_admin">{t("policySingle")}</SelectItem>
            <SelectItem value="two_person">{t("policyTwo")}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("settingsQueueTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsQueueBody")}</p>
        <Select value={order} onValueChange={(v) => setOrder(v as QueueOrder)}>
          <SelectTrigger className="mt-3 sm:w-80" aria-label={t("settingsQueueTitle")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oldest_first">{t("sortOldest")}</SelectItem>
            <SelectItem value="newest_first">{t("sortNewest")}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("settingsRetentionTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsRetentionBody")}</p>
        <Select value={retention} onValueChange={setRetention}>
          <SelectTrigger className="mt-3 sm:w-80" aria-label={t("settingsRetentionTitle")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETENTION_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o === "unset" ? t("retentionUnset") : t("retentionDays", { days: Number(o) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <Button variant="hero" size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
        {t("settingsSave")}
      </Button>

      <section className={card}>
        <h2 className="font-semibold">{t("settingsNotifyTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsNotifyBody")}</p>
        <div className="mt-4 space-y-3">
          {(["notifyTelegram", "notifyEmail"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-xl bg-muted/60 p-3">
              <span className="text-sm">
                {t(k)} <span className="text-xs text-muted-foreground">· {t("notAvailable")}</span>
              </span>
              <Switch checked={false} disabled aria-label={t(k)} />
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("settingsAutomationTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsAutomationBody")}</p>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 p-3">
          <span className="text-sm">{t("automationOff")}</span>
          <Switch checked={false} disabled aria-label={t("settingsAutomationTitle")} />
        </div>
      </section>

      <SetupGuide />
    </div>
  );
}
