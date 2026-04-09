import { useState, useEffect, useRef } from "react";
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
} from "@heroui/react";
import {
  Cpu,
  Plus,
  Trash2,
  QrCode,
  Upload,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

type DeviceRow = {
  device_id: string;
  device_name: string;
  scopes: string[];
  rate_limit: number;
};

type RegisteredDevice = {
  device_id: string;
  service_id: string;
  client_id: string;
  client_secret: string;
  success: boolean;
};

const IOT_SCOPES = ["read", "write", "telemetry", "command"];

export default function IoT() {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin");
  const canRegister = hasRole("admin", "operator");

  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [prefix, setPrefix] = useState("iot");
  const [devices, setDevices] = useState<DeviceRow[]>([
    { device_id: "", device_name: "", scopes: ["read"], rate_limit: 10 },
  ]);
  const [registering, setRegistering] = useState(false);
  const [results, setResults] = useState<RegisteredDevice[] | null>(null);
  const [qrDevice, setQrDevice] = useState<RegisteredDevice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFleet();
  }, []);

  const loadFleet = async () => {
    setLoading(true);
    try {
      const all = await api.listServices();
      setServices(all.filter((s: any) => s.service_id.startsWith("iot-") || s.description?.startsWith("IoT device")));
    } catch {
      toast.error("Error al cargar flota");
    } finally {
      setLoading(false);
    }
  };

  const addRow = () =>
    setDevices([...devices, { device_id: "", device_name: "", scopes: ["read"], rate_limit: 10 }]);

  const removeRow = (i: number) => setDevices(devices.filter((_, idx) => idx !== i));

  const updateRow = (i: number, patch: Partial<DeviceRow>) =>
    setDevices(devices.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const toggleScope = (i: number, scope: string) => {
    const row = devices[i];
    const scopes = row.scopes.includes(scope)
      ? row.scopes.filter((s) => s !== scope)
      : [...row.scopes, scope];
    updateRow(i, { scopes });
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n").slice(1);
      const parsed: DeviceRow[] = lines
        .map((line) => {
          const [device_id, device_name, scopes, rate_limit] = line.split(",").map((s) => s.trim());
          if (!device_id) return null;
          return {
            device_id,
            device_name: device_name || device_id,
            scopes: scopes ? scopes.split(";") : ["read"],
            rate_limit: parseInt(rate_limit) || 10,
          };
        })
        .filter(Boolean) as DeviceRow[];
      if (parsed.length > 0) {
        setDevices(parsed);
        toast.success(`${parsed.length} dispositivos cargados desde CSV`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkRegister = async () => {
    const valid = devices.filter((d) => d.device_id.trim());
    if (valid.length === 0) {
      toast.error("Agrega al menos un dispositivo");
      return;
    }
    setRegistering(true);
    try {
      const res = await api.bulkRegisterDevices({ prefix, devices: valid });
      setResults(res.devices);
      toast.success(`${res.registered}/${res.total} dispositivos registrados`);
      loadFleet();
    } catch (err: any) {
      toast.error(err.message || "Error en registro masivo");
    } finally {
      setRegistering(false);
    }
  };

  const generateQRData = (dev: RegisteredDevice) =>
    JSON.stringify({
      auth_url: window.location.origin,
      service_id: dev.service_id,
      client_id: dev.client_id,
      client_secret: dev.client_secret,
    });

  const iotDevices = services;
  const activeCount = iotDevices.filter((s) => s.is_active !== false).length;
  const lockedCount = iotDevices.filter((s) => s.is_active === false).length;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">IoT / Edge</h1>
          <p className="text-muted">
            Gestiona tu flota de dispositivos, sensores y edge nodes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onPress={loadFleet}>
            <RefreshCw size={16} />
          </Button>
          {canRegister && (
            <Button
              variant="primary"
              onPress={() => {
                setShowBulk(!showBulk);
                setResults(null);
              }}
              className="font-semibold shadow-lg shadow-accent/20"
            >
              <Plus size={18} />
              {showBulk ? "Cerrar" : "Registro Masivo"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cpu size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{iotDevices.length}</p>
              <p className="text-xs text-muted">Total dispositivos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Wifi size={18} className="text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger/10">
              <WifiOff size={18} className="text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lockedCount}</p>
              <p className="text-xs text-muted">Bloqueados</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Bulk register form */}
      {showBulk && (
        <Card className="shadow-md">
          <Card.Header className="flex items-center justify-between px-6 pt-6">
            <div className="flex gap-2 items-center">
              <Upload size={18} className="text-accent" />
              <h2 className="text-xl font-bold">Registro masivo de dispositivos</h2>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSV}
              />
              <Button
                size="sm"
                variant="secondary"
                onPress={() => fileRef.current?.click()}
              >
                <Upload size={14} /> Importar CSV
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="p-6 space-y-4">
            <p className="text-xs text-muted">
              CSV esperado: <code>device_id,device_name,scopes(;separados),rate_limit</code>
            </p>
            <div className="flex gap-4 items-end">
              <TextField className="w-48">
                <Label>Prefijo</Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="iot"
                />
              </TextField>
            </div>

            <div className="space-y-3">
              {devices.map((dev, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-start p-3 rounded-lg bg-default/5 border border-border"
                >
                  <TextField className="flex-1" isRequired>
                    <Label className="text-xs">Device ID</Label>
                    <Input
                      value={dev.device_id}
                      onChange={(e) => updateRow(i, { device_id: e.target.value })}
                      placeholder="sensor-001"
                    />
                  </TextField>
                  <TextField className="flex-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={dev.device_name}
                      onChange={(e) => updateRow(i, { device_name: e.target.value })}
                      placeholder="Sensor Temperatura"
                    />
                  </TextField>
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1.5">Scopes</p>
                    <div className="flex flex-wrap gap-1">
                      {IOT_SCOPES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleScope(i, s)}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            dev.scopes.includes(s)
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-surface border-border text-muted hover:border-accent/50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextField className="w-24">
                    <Label className="text-xs">Rate/min</Label>
                    <Input
                      type="number"
                      value={String(dev.rate_limit)}
                      onChange={(e) => updateRow(i, { rate_limit: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                  </TextField>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="text-danger mt-5"
                    onPress={() => removeRow(i)}
                    isDisabled={devices.length === 1}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-between">
              <Button size="sm" variant="secondary" onPress={addRow}>
                <Plus size={14} /> Agregar dispositivo
              </Button>
              <Button
                variant="primary"
                isPending={registering}
                onPress={handleBulkRegister}
                className="px-8"
              >
                Registrar {devices.filter((d) => d.device_id.trim()).length} dispositivo(s)
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Results after bulk register */}
      {results && (
        <Card className="shadow-md">
          <Card.Header className="flex gap-2 px-6 pt-5">
            <CheckCircle2 size={18} className="text-success" />
            <h2 className="text-lg font-bold">Resultados del registro</h2>
          </Card.Header>
          <Card.Content className="p-6">
            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.device_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    r.success
                      ? "bg-success/5 border-success/20"
                      : "bg-danger/5 border-danger/20"
                  }`}
                >
                  {r.success ? (
                    <CheckCircle2 size={16} className="text-success shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-danger shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.service_id}</p>
                    <p className="text-xs text-muted truncate">
                      client: <code>{r.client_id}</code>
                    </p>
                  </div>
                  {r.success && (
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          className="text-accent"
                          onPress={() => setQrDevice(r)}
                        >
                          <QrCode size={16} />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Ver QR de provisioning</Tooltip.Content>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Fleet view */}
      <Card className="shadow-sm overflow-hidden">
        <Card.Header className="flex gap-2 px-6 pt-5">
          <Cpu size={18} className="text-accent" />
          <h2 className="text-lg font-bold">Flota de dispositivos</h2>
          <Chip size="sm" variant="soft" className="ml-auto">
            {iotDevices.length}
          </Chip>
        </Card.Header>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Flota IoT">
              <Table.Header>
                <Table.Column isRowHeader>DISPOSITIVO</Table.Column>
                <Table.Column>SCOPES</Table.Column>
                <Table.Column>RATE LIMIT</Table.Column>
                <Table.Column>ESTADO</Table.Column>
                <Table.Column className="text-center">ACCIONES</Table.Column>
              </Table.Header>
              <Table.Body
                items={iotDevices}
                renderEmptyState={() => (
                  <p className="text-center py-8 text-muted">
                    No hay dispositivos IoT registrados. Usa "Registro Masivo" para agregar.
                  </p>
                )}
              >
                {(svc: any) => {
                  const isLocked = svc.is_active === false;
                  return (
                    <Table.Row key={svc.service_id} id={svc.service_id}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <Cpu size={14} className={isLocked ? "text-danger" : "text-success"} />
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{svc.service_name}</span>
                            <span className="text-xs text-muted">{svc.service_id}</span>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {(svc.allowed_scopes || []).map((scope: string) => (
                            <Chip key={scope} size="sm" variant="soft" className="text-xs h-5">
                              {scope}
                            </Chip>
                          ))}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {svc.rate_limit > 0 ? (
                          <Chip size="sm" variant="secondary">{svc.rate_limit}/min</Chip>
                        ) : (
                          <span className="text-xs text-muted">Sin limite</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={isLocked ? "danger" : "success"}
                          variant="soft"
                        >
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                              isLocked ? "bg-danger" : "bg-success animate-pulse"
                            }`}
                          />
                          {isLocked ? "Bloqueado" : "Online"}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-center gap-1">
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                className="text-accent"
                                onPress={() => navigate(`/services/${svc.service_id}`)}
                              >
                                <Eye size={16} />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Ver detalle</Tooltip.Content>
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
      </Card>

      {/* QR Provisioning Modal */}
      {qrDevice && (
        <Modal>
          <Modal.Backdrop
            isOpen={!!qrDevice}
            onOpenChange={(open) => !open && setQrDevice(null)}
            variant="blur"
          >
            <Modal.Container size="sm">
              <Modal.Dialog>
                <Modal.Header className="flex items-center gap-3 pb-4">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <QrCode className="text-accent" size={20} />
                  </div>
                  <div>
                    <Modal.Heading className="text-lg font-bold">
                      QR Provisioning
                    </Modal.Heading>
                    <p className="text-xs text-muted font-normal">
                      {qrDevice.service_id}
                    </p>
                  </div>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <div className="flex justify-center p-4 bg-white rounded-xl">
                    <QRCodeSVG data={generateQRData(qrDevice)} size={200} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted">Service ID</p>
                      <code className="text-xs bg-default/10 px-2 py-1 rounded block">
                        {qrDevice.service_id}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Client ID</p>
                      <code className="text-xs bg-default/10 px-2 py-1 rounded block">
                        {qrDevice.client_id}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Client Secret</p>
                      <code className="text-xs bg-default/10 px-2 py-1 rounded block break-all">
                        {qrDevice.client_secret}
                      </code>
                    </div>
                  </div>
                  <p className="text-xs text-muted text-center">
                    Escanea este QR desde el dispositivo para provisionar automaticamente las credenciales.
                  </p>
                </Modal.Body>
                <Modal.Footer className="border-t border-border pt-4">
                  <Button variant="secondary" onPress={() => setQrDevice(null)}>
                    Cerrar
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => {
                      navigator.clipboard.writeText(generateQRData(qrDevice));
                      toast.success("Credenciales copiadas al portapapeles");
                    }}
                  >
                    Copiar JSON
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </div>
  );
}

/* ─── QR Code SVG Generator ─── */

function QRCodeSVG({ data, size = 200 }: { data: string; size?: number }) {
  const matrix = generateQRMatrix(data);
  const cellSize = size / matrix.length;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {matrix.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function generateQRMatrix(data: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false),
  );

  const addFinderPattern = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (
          y === 0 || y === 6 || x === 0 || x === 6 ||
          (y >= 2 && y <= 4 && x >= 2 && x <= 4)
        ) {
          matrix[startY + y][startX + x] = true;
        }
      }
    }
  };

  addFinderPattern(0, 0);
  addFinderPattern(size - 7, 0);
  addFinderPattern(0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let bitIndex = 0;
  const bytes = new TextEncoder().encode(data);
  const bits: boolean[] = [];
  for (const byte of bytes) {
    for (let j = 7; j >= 0; j--) {
      bits.push(((byte >> j) & 1) === 1);
    }
  }

  for (let x = size - 1; x >= 1; x -= 2) {
    if (x === 6) x = 5;
    for (let y = 0; y < size; y++) {
      for (let dx = 0; dx <= 1; dx++) {
        const col = x - dx;
        if (matrix[y][col]) continue;
        if (y < 9 && col < 9) continue;
        if (y < 9 && col > size - 9) continue;
        if (y > size - 9 && col < 9) continue;
        if (y === 6 || col === 6) continue;
        if (bitIndex < bits.length) {
          matrix[y][col] = bits[bitIndex] !== ((y + col) % 2 === 0);
          bitIndex++;
        }
      }
    }
  }

  return matrix;
}
