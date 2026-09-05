import paramiko
import sys
import time

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('100.84.82.77', username='server', password='server')

def run(cmd):
    print(f"=== CMD: {cmd} ===")
    stdin, stdout, stderr = client.exec_command(f"echo server | sudo -S {cmd}")
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("OUT:", out)
    if err:
        filtered_err = "\n".join([l for l in err.splitlines() if "[sudo]" not in l])
        if filtered_err:
            print("ERR:", filtered_err)

print("1. Recompilando y levantando contenedor con CasaOS compose...")
run("docker compose -f /var/lib/casaos/apps/carcassonne/docker-compose.yml up -d --force-recreate")

print("2. Verificando estado en CasaOS...")
run("casaos-cli app-management list apps")

print("3. Verificando docker ps:")
run("docker ps --filter name=carcassonne")

print("4. Probando HTTP 3080:")
run("curl -s -o /dev/null -w '%{http_code}' http://localhost:3080/")

client.close()
