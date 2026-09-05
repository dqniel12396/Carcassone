import os
import sys
import paramiko
import tarfile
import tempfile
import io
import time

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '100.84.82.77'
USER = 'server'
PASS = 'server'
REMOTE_PATH = '/DATA/AppData/carcassonne-web'
LOCAL_PATH = os.path.abspath('f:/Proyectos/CASAosServer/carcassonne-web')

def log(msg):
    print(msg, flush=True)

def run_cmd(client, cmd):
    log(f"💻 [SSH] {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out.strip():
        log(f"📄 {out.strip()}")
    if err.strip() and "warning" not in err.lower():
        log(f"⚠️ {err.strip()}")
    return out, err

def deploy():
    log(f"🚀 Conectando al servidor CasaOS en {HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    connected = False
    for attempt in range(3):
        try:
            client.connect(HOST, username=USER, password=PASS, timeout=20)
            connected = True
            break
        except Exception as e:
            log(f"⚠️ Intento {attempt+1}/3 falló ({e}). Reintentando en 3s...")
            time.sleep(3)
            
    if not connected:
        log("❌ No se pudo conectar a CasaOS.")
        return
        
    log("✅ Conexión SSH establecida con éxito.")

    # 1. Empaquetar proyecto
    log("📦 Empaquetando archivos del proyecto (excluyendo node_modules)...")
    tar_stream = io.BytesIO()
    with tarfile.open(fileobj=tar_stream, mode='w:gz') as tar:
        for root, dirs, files in os.walk(LOCAL_PATH):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.gemini']]
            for file in files:
                if file.startswith('scratch_'):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, LOCAL_PATH)
                tar.add(full_path, arcname=rel_path)

    tar_bytes = tar_stream.getvalue()
    log(f"📦 Paquete listo ({len(tar_bytes)/1024/1024:.2f} MB)")

    # 2. Subir vía SFTP
    log("📤 Subiendo a /tmp/carcassonne_deploy.tar.gz...")
    sftp = client.open_sftp()
    sftp.putfo(io.BytesIO(tar_bytes), '/tmp/carcassonne_deploy.tar.gz')
    sftp.close()
    log("✅ Subida completada.")

    # 3. Preparar directorio remoto y descomprimir
    run_cmd(client, f"echo {PASS} | sudo -S mkdir -p {REMOTE_PATH}")
    run_cmd(client, f"echo {PASS} | sudo -S chown -R server:server {REMOTE_PATH}")
    run_cmd(client, f"tar -xzf /tmp/carcassonne_deploy.tar.gz -C {REMOTE_PATH}")
    run_cmd(client, "rm -f /tmp/carcassonne_deploy.tar.gz")
    log("✅ Archivos extraídos en /DATA/AppData/carcassonne-web.")

    # 4. Construir imagen Docker
    log("🐳 Compilando imagen Docker en CasaOS...")
    run_cmd(client, f"docker build -t carcassonne-web:latest {REMOTE_PATH}")
    run_cmd(client, "docker rm -f carcassonne carcassonne-server carcassonne-web 2>/dev/null || true")


    # 6. Registrar / Actualizar Acceso Directo e Ícono en CasaOS
    log("🎨 Configurando acceso directo oficial en el panel de CasaOS...")
    casaos_compose = """name: carcassonne
services:
    carcassonne:
        container_name: carcassonne
        image: carcassonne-web:latest
        labels:
            icon: https://api.iconify.design/noto:castle.svg
        networks:
            default: null
        ports:
            - mode: ingress
              target: 3080
              published: "3080"
              protocol: tcp
        restart: unless-stopped
        volumes:
            - type: bind
              source: /DATA/AppData/carcassonne-web/data
              target: /app/data
              bind:
                create_host_path: true
networks:
    default:
        name: carcassonne_default
x-casaos:
    architectures:
        - amd64
        - arm64
    author: Daniel
    category: Games
    description:
        en_us: "Carcassonne Medieval Strategy Board Game with AI & Online Multiplayer"
        es_es: "Carcassonne Juego de Estrategia Medieval con IA Gemini y Multijugador Online"
    developer: Daniel
    icon: https://api.iconify.design/noto:castle.svg
    index: /
    is_headless: false
    is_uncontrolled: false
    main: carcassonne
    port_map: "3080"
    scheme: http
    screenshot_link: []
    tagline:
        en_us: "Carcassonne Strategy Board Game"
        es_es: "Carcassonne - Gran Mesa"
    thumbnail: https://api.iconify.design/noto:castle.svg
    title:
        custom: "Carcassonne"
        en_us: "Carcassonne"
        es_es: "Carcassonne"
"""
    sftp = client.open_sftp()
    with sftp.file("/tmp/carcassonne-casaos.yml", "w") as f:
        f.write(casaos_compose.strip())
    sftp.close()

    run_cmd(client, f"echo {PASS} | sudo -S rm -rf /var/lib/casaos/apps/carcassonne-server")
    run_cmd(client, f"echo {PASS} | sudo -S mkdir -p /var/lib/casaos/apps/carcassonne")
    run_cmd(client, f"echo {PASS} | sudo -S cp /tmp/carcassonne-casaos.yml /var/lib/casaos/apps/carcassonne/docker-compose.yml")
    run_cmd(client, f"echo {PASS} | sudo -S rm -f /tmp/carcassonne-casaos.yml")
    run_cmd(client, "docker compose -f /var/lib/casaos/apps/carcassonne/docker-compose.yml up -d --force-recreate")
    run_cmd(client, f"echo {PASS} | sudo -S systemctl restart casaos-app-management.service || true")
    log("✅ Acceso directo e ícono registrados en CasaOS.")

    # 7. Probar HTTP
    curl_out, _ = run_cmd(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3080/")
    log(f"🌐 Verificación HTTP en CasaOS: Código {curl_out.strip()}")

    client.close()
    log("\n🎉 ¡DESPLIEGUE FINALIZADO EXITOSAMENTE!")
    log(f"🏰 Acceso Remoto (Tailscale): http://100.84.82.77:3080")
    log(f"🌐 Acceso Red Local (LAN): http://192.168.18.96:3080")
    log(f"📱 Enlace directo en panel CasaOS: http://100.84.82.77 (o http://192.168.18.96)")

if __name__ == '__main__':
    deploy()
