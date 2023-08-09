import subprocess

def get_all_services():
    try:
        # The command for getting all services in Windows
        command_output = subprocess.check_output("sc query state= all", shell=True)
        # The command output is a byte string, we decode it to a normal string
        command_output = command_output.decode('utf-8')
        # We split the output into lines and get the service names
        services = [line.split(':')[1].strip() for line in command_output.split('\n') if 'SERVICE_NAME' in line]
        return services
    except Exception as e:
        print("Error while getting the services:", e)
        return []

def start_service(service_name):
    try:
        subprocess.check_output(f"net start \"{service_name}\"", shell=True)
    except Exception as e:
        print(f"Error while starting the service {service_name}:", e)

def stop_service(service_name):
    command_to_execute = f"sc stop \"{service_name}\""
    print("Executing:", command_to_execute)
    try:
        output = subprocess.check_output(command_to_execute, shell=True, stderr=subprocess.STDOUT, timeout=20)
        print("Command Output:", output.decode())
    except subprocess.CalledProcessError as e:
        print("Command returned an error:", e.output.decode())
    except Exception as e:
        print(f"Error while stopping the service {service_name}:", e)




def restart_service(service_name):
    stop_service(service_name)
    start_service(service_name)

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'get_all_services':
        services = get_all_services()
        for service in services:
            print(service)
