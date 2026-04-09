import { useState, useEffect } from "react";
import {
  Button,
  Card,
  Chip,
  TextField,
  Label,
  Input,
  Modal,
  Table,
  Tooltip,
  Skeleton,
  useOverlayState,
} from "@heroui/react";
import {
  KeyRound,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Shield,
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

const ALL_SCOPES = ["read", "write", "admin", "telemetry", "command"];

/* ────────────────── Partner View ────────────────── */

function PartnerView() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<{ quota: any; usage: any } | null>(null);
  const createModal = useOverlayState({});
  const [form, setForm] = useState({ service_name: "", description: "", scopes: ["read"], rate_limit: 0 });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [k, q] = await Promise.all([api.listPartnerKeys(), api.getPartnerQuota()]);
      setKeys(k);
      setQuota(q);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleScope = (scope: string) => {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope)
        ? f.scopes.filter((s) => s !== scope)
        : [...f.scopes, scope],
    }));
  };

  const handleCreate = async () => {
    if (!form.service_name.trim()) {
      toast.error("Nombre del servicio requerido");
      return;
    }
    setCreating(true);
    try {
      const res = await api.createPartnerKey(form);
      setCreated(res);
      setSecretVisible(false);
      createModal.close();
      setForm({ service_name: "", description: "", scopes: ["read"], rate_limit: 0 });
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al crear API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deletePartnerKey(deleteTarget);
      toast.success("API key revocada");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al revocar");
    } finally {
      setDeleting(false);
    }
  };

  const allowedScopes: string[] = quota?.quota?.allowed_scopes || ALL_SCOPES;
  const maxRate = quota?.quota?.max_rate_limit || 100;
  const used = quota?.usage?.services_used || 0;
  const max = quota?.quota?.max_services || 5;
  const pct = max > 0 ? Math.round((used / max) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis API Keys</h1>
          <p className="text-muted">Gestiona tus credenciales de integracion.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onPress={load}><RefreshCw size={16} /></Button>
          <Button variant="primary" onPress={createModal.open} isDisabled={used >= max}>
            <Plus size={18} /> Nueva API Key
          </Button>
        </div>
      </div>

      {/* Quota bar */}
      {quota && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-accent" />
              <span className="text-sm font-medium">Cuota de servicios</span>
            </div>
            <span className="text-sm text-muted">{used} / {max}</span>
          </div>
          <div className="w-full bg-default/20 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted">
            <span>Rate limit max: <strong>{maxRate}/min</strong></span>
            <span>Scopes: {allowedScopes.join(", ")}</span>
          </div>
        </Card>
      )}

      {/* Keys table */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="API Keys">
            <Table.Header>
              <Table.Column isRowHeader>Servicio</Table.Column>
              <Table.Column>Client ID</Table.Column>
              <Table.Column>Scopes</Table.Column>
              <Table.Column>Rate Limit</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Acciones</Table.Column>
            </Table.Header>
            <Table.Body
              items={keys}
              renderEmptyState={() =>
                loading ? (
                  <div className="w-full space-y-3 p-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="w-full h-10 rounded-lg" />)}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted">No tienes API keys. Crea una para empezar.</p>
                )
              }
            >
              {(key: any) => (
                <Table.Row key={key.service_id} id={key.service_id}>
                  <Table.Cell>
                    <div>
                      <p className="font-medium text-sm">{key.service_name}</p>
                      <p className="text-xs text-muted">{key.service_id}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <code className="text-xs bg-default/10 px-2 py-0.5 rounded">{key.client_id}</code>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((s: string) => (
                        <Chip key={s} size="sm" variant="soft" className="text-xs h-5">{s}</Chip>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {key.rate_limit > 0 ? (
                      <Chip size="sm" variant="secondary">{key.rate_limit}/min</Chip>
                    ) : (
                      <span className="text-xs text-muted">Sin limite</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" color={key.is_active ? "success" : "danger"} variant="soft">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${key.is_active ? "bg-success" : "bg-danger"}`} />
                      {key.is_active ? "Activa" : "Revocada"}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly size="sm" variant="ghost" className="text-danger"
                          onPress={() => setDeleteTarget(key.service_id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Revocar key</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Create modal */}
      {createModal.isOpen && (
        <Modal>
          <Modal.Backdrop isOpen={createModal.isOpen} onOpenChange={(open) => !open && createModal.close()}>
            <Modal.Container>
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>Nueva API Key</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <TextField isRequired>
                    <Label>Nombre del servicio</Label>
                    <Input
                      value={form.service_name}
                      onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                      placeholder="Mi Integracion"
                    />
                  </TextField>
                  <TextField>
                    <Label>Descripcion</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Opcional"
                    />
                  </TextField>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Scopes</label>
                    <div className="flex flex-wrap gap-2">
                      {allowedScopes.map((s) => (
                        <button
                          key={s} type="button" onClick={() => toggleScope(s)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            form.scopes.includes(s)
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-surface border-border text-muted hover:border-accent/50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextField>
                    <Label>Rate limit (req/min, 0 = sin limite, max {maxRate})</Label>
                    <Input
                      type="number"
                      value={String(form.rate_limit)}
                      onChange={(e) => setForm({ ...form, rate_limit: Math.min(parseInt(e.target.value) || 0, maxRate) })}
                      min={0} max={maxRate}
                    />
                  </TextField>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={createModal.close} isDisabled={creating}>Cancelar</Button>
                  <Button variant="primary" onPress={handleCreate} isPending={creating}>Crear</Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      {/* Credentials modal (shown after creation) */}
      {created && (
        <Modal>
          <Modal.Backdrop isOpen={!!created} onOpenChange={(open) => !open && setCreated(null)} variant="blur">
            <Modal.Container size="sm">
              <Modal.Dialog>
                <Modal.Header className="flex items-center gap-3 pb-4">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <KeyRound className="text-success" size={20} />
                  </div>
                  <div>
                    <Modal.Heading className="text-lg font-bold">API Key creada</Modal.Heading>
                    <p className="text-xs text-muted font-normal">{created.service_name}</p>
                  </div>
                </Modal.Header>
                <Modal.Body className="space-y-3">
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                    <p className="text-warning text-sm font-medium">Guarda el Client Secret ahora. No se mostrara de nuevo.</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Service ID</p>
                    <code className="text-xs bg-default/10 px-2 py-1 rounded block">{created.service_id}</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Client ID</p>
                    <code className="text-xs bg-default/10 px-2 py-1 rounded block">{created.client_id}</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Client Secret</p>
                    <div className="flex gap-2 items-center">
                      <code className="text-xs bg-default/10 px-2 py-1 rounded block flex-1 break-all">
                        {secretVisible ? created.client_secret : "********************************"}
                      </code>
                      <Button isIconOnly size="sm" variant="ghost" onPress={() => setSecretVisible(!secretVisible)}>
                        {secretVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {created.scopes.map((s: string) => (
                      <Chip key={s} size="sm" variant="soft">{s}</Chip>
                    ))}
                  </div>
                </Modal.Body>
                <Modal.Footer className="border-t border-border pt-4">
                  <Button variant="secondary" onPress={() => setCreated(null)}>Cerrar</Button>
                  <Button
                    variant="primary"
                    onPress={() => {
                      const text = `Client ID: ${created.client_id}\nClient Secret: ${created.client_secret}`;
                      navigator.clipboard.writeText(text);
                      toast.success("Credenciales copiadas");
                    }}
                  >
                    <Copy size={14} /> Copiar credenciales
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Revocar API Key"
        message={`Estas seguro de revocar la API key "${deleteTarget}"? El servicio asociado sera eliminado permanentemente.`}
        confirmLabel="Revocar"
        confirmColor="danger"
        loading={deleting}
      />
    </div>
  );
}

/* ────────────────── Admin View ────────────────── */

function AdminView() {
  const [partners, setPartners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [partnerKeys, setPartnerKeys] = useState<Record<number, any[]>>({});
  const [loadingKeys, setLoadingKeys] = useState<number | null>(null);

  // Quota edit
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [quotaForm, setQuotaForm] = useState({ max_services: 5, max_rate_limit: 100, allowed_scopes: ["read", "write"] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const users = await api.listUsers();
      setPartners(users.filter((u: any) => u.role === "partner"));
    } catch {
      toast.error("Error al cargar partners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadKeysForPartner = async (partner: User) => {
    if (expanded === partner.id) {
      setExpanded(null);
      return;
    }
    setExpanded(partner.id);
    if (partnerKeys[partner.id]) return;
    setLoadingKeys(partner.id);
    try {
      const all = await api.listServices();
      const owned = all.filter((s: any) => s.service_id.startsWith(`partner-${partner.id}-`));
      setPartnerKeys((prev) => ({ ...prev, [partner.id]: owned }));
    } catch {
      toast.error("Error al cargar keys");
    } finally {
      setLoadingKeys(null);
    }
  };

  const openEditQuota = (partner: User) => {
    const q = partner.partner_quota || { max_services: 5, max_rate_limit: 100, allowed_scopes: ["read", "write"] };
    setQuotaForm({ max_services: q.max_services, max_rate_limit: q.max_rate_limit, allowed_scopes: [...q.allowed_scopes] });
    setEditTarget(partner);
  };

  const handleSaveQuota = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.updatePartnerQuota(editTarget.id, quotaForm);
      toast.success(`Cuota de "${editTarget.username}" actualizada`);
      setEditTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar cuota");
    } finally {
      setSaving(false);
    }
  };

  const toggleQuotaScope = (scope: string) => {
    setQuotaForm((f) => ({
      ...f,
      allowed_scopes: f.allowed_scopes.includes(scope)
        ? f.allowed_scopes.filter((s) => s !== scope)
        : [...f.allowed_scopes, scope],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys - Partners</h1>
          <p className="text-muted">Gestiona integradores externos y sus cuotas.</p>
        </div>
        <Button variant="ghost" onPress={load}><RefreshCw size={16} /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <KeyRound size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{partners.length}</p>
              <p className="text-xs text-muted">Partners registrados</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Shield size={18} className="text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{partners.filter((p) => p.is_active).length}</p>
              <p className="text-xs text-muted">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-default/10">
              <Settings size={18} className="text-muted" />
            </div>
            <div>
              <p className="text-2xl font-bold">{partners.filter((p) => !p.is_active).length}</p>
              <p className="text-xs text-muted">Inactivos</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Partners table */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Partners">
            <Table.Header>
              <Table.Column isRowHeader>Partner</Table.Column>
              <Table.Column>Email</Table.Column>
              <Table.Column>Cuota</Table.Column>
              <Table.Column>Scopes permitidos</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Acciones</Table.Column>
            </Table.Header>
            <Table.Body
              items={partners}
              renderEmptyState={() =>
                loading ? (
                  <div className="w-full space-y-3 p-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="w-full h-10 rounded-lg" />)}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted">No hay partners. Crea uno desde Usuarios con rol "Partner".</p>
                )
              }
            >
              {(partner: User) => {
                const q = partner.partner_quota || { max_services: 5, max_rate_limit: 100, allowed_scopes: ["read", "write"] };
                return (
                  <Table.Row key={partner.id} id={String(partner.id)}>
                    <Table.Cell className="font-medium">{partner.username}</Table.Cell>
                    <Table.Cell className="text-sm text-muted">{partner.email}</Table.Cell>
                    <Table.Cell>
                      <div className="text-xs">
                        <span>{q.max_services} servicios</span>
                        <span className="text-muted"> | {q.max_rate_limit}/min</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {q.allowed_scopes.map((s: string) => (
                          <Chip key={s} size="sm" variant="soft" className="text-xs h-5">{s}</Chip>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" color={partner.is_active ? "success" : "default"} variant="soft">
                        {partner.is_active ? "Activo" : "Inactivo"}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <Tooltip.Trigger>
                            <Button isIconOnly size="sm" variant="ghost" className="text-accent" onPress={() => loadKeysForPartner(partner)}>
                              <Eye size={16} />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Ver API keys</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                          <Tooltip.Trigger>
                            <Button isIconOnly size="sm" variant="ghost" onPress={() => openEditQuota(partner)}>
                              <Settings size={16} />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Editar cuota</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Expanded keys */}
      {expanded !== null && (
        <Card className="shadow-md">
          <Card.Header className="px-6 pt-5 flex items-center gap-2">
            <KeyRound size={16} className="text-accent" />
            <h3 className="font-bold">
              API Keys de {partners.find((p) => p.id === expanded)?.username}
            </h3>
          </Card.Header>
          <Card.Content className="p-6">
            {loadingKeys === expanded ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="w-full h-10 rounded-lg" />)}
              </div>
            ) : (partnerKeys[expanded] || []).length === 0 ? (
              <p className="text-muted text-sm">Este partner no tiene API keys registradas.</p>
            ) : (
              <div className="space-y-2">
                {(partnerKeys[expanded] || []).map((svc: any) => (
                  <div key={svc.service_id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{svc.service_name}</p>
                      <p className="text-xs text-muted">{svc.service_id} | <code>{svc.client_id}</code></p>
                    </div>
                    <div className="flex gap-1">
                      {(svc.allowed_scopes || []).map((s: string) => (
                        <Chip key={s} size="sm" variant="soft" className="text-xs h-5">{s}</Chip>
                      ))}
                    </div>
                    <Chip size="sm" color={svc.is_active !== false ? "success" : "danger"} variant="soft">
                      {svc.is_active !== false ? "Activa" : "Revocada"}
                    </Chip>
                  </div>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Edit quota modal */}
      {editTarget && (
        <Modal>
          <Modal.Backdrop isOpen={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
            <Modal.Container>
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>Editar cuota - {editTarget.username}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <TextField>
                    <Label>Max servicios</Label>
                    <Input
                      type="number"
                      value={String(quotaForm.max_services)}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_services: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </TextField>
                  <TextField>
                    <Label>Max rate limit (req/min)</Label>
                    <Input
                      type="number"
                      value={String(quotaForm.max_rate_limit)}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_rate_limit: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </TextField>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Scopes permitidos</label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_SCOPES.map((s) => (
                        <button
                          key={s} type="button" onClick={() => toggleQuotaScope(s)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            quotaForm.allowed_scopes.includes(s)
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-surface border-border text-muted hover:border-accent/50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={() => setEditTarget(null)} isDisabled={saving}>Cancelar</Button>
                  <Button variant="primary" onPress={handleSaveQuota} isPending={saving}>Guardar</Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </div>
  );
}

/* ────────────────── Main Component ────────────────── */

export default function ApiKeys() {
  const { hasRole } = useAuthStore();
  if (hasRole("partner")) return <PartnerView />;
  return <AdminView />;
}
