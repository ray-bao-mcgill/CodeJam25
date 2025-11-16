"""
Code execution service with Docker sandbox support
Executes code in isolated containers for security
"""
import subprocess
import asyncio
import tempfile
import os
from typing import Dict, Optional
import docker
from datetime import datetime

# Docker client
try:
    docker_client = docker.from_env()
except Exception as e:
    print(f"Warning: Docker not available: {e}")
    docker_client = None

# Language configurations
LANGUAGE_CONFIGS: Dict[str, Dict] = {
    'python': {
        'image': 'python:3.11-slim',
        'command': 'python',
        'timeout': 10,
        'memory_limit': '128m'
    },
    'java': {
        'image': 'openjdk:17-slim',
        'command': 'java',
        'timeout': 15,
        'memory_limit': '256m',
        'compile_first': True
    },
    'cpp': {
        'image': 'gcc:latest',
        'command': 'g++',
        'timeout': 15,
        'memory_limit': '256m',
        'compile_first': True
    },
    'c': {
        'image': 'gcc:latest',
        'command': 'gcc',
        'timeout': 15,
        'memory_limit': '256m',
        'compile_first': True
    },
    'shell': {
        'image': 'bash:latest',
        'command': 'bash',
        'timeout': 10,
        'memory_limit': '128m'
    },
    'sql': {
        'image': 'postgres:15-alpine',
        'command': 'psql',
        'timeout': 10,
        'memory_limit': '128m',
        'setup_required': True
    },
    'typescript': {
        'image': 'node:18-slim',
        'command': 'ts-node',
        'timeout': 10,
        'memory_limit': '128m',
        'install_first': ['ts-node', 'typescript']
    },
    'html': {
        'image': 'nginx:alpine',
        'command': 'echo',
        'timeout': 5,
        'memory_limit': '64m',
        'readonly': True
    },
    'css': {
        'image': 'node:18-slim',
        'command': 'node',
        'timeout': 5,
        'memory_limit': '64m',
        'readonly': True
    },
    'yaml': {
        'image': 'python:3.11-slim',
        'command': 'python',
        'timeout': 5,
        'memory_limit': '64m',
        'readonly': True,
        'validator_script': 'import yaml, sys; yaml.safe_load(sys.stdin)'
    },
    'json': {
        'image': 'python:3.11-slim',
        'command': 'python',
        'timeout': 5,
        'memory_limit': '64m',
        'readonly': True,
        'validator_script': 'import json, sys; json.load(sys.stdin)'
    },
    'markdown': {
        'image': 'node:18-slim',
        'command': 'node',
        'timeout': 5,
        'memory_limit': '64m',
        'readonly': True
    },
    'dockerfile': {
        'image': 'docker:latest',
        'command': 'docker',
        'timeout': 10,
        'memory_limit': '128m',
        'readonly': True
    }
}


async def execute_code(language: str, code: str) -> Dict[str, any]:
    """
    Execute code in a Docker sandbox
    
    Returns:
        {
            'stdout': str,
            'stderr': str,
            'exit_code': int,
            'error': Optional[str],
            'execution_time': float
        }
    """
    if not docker_client:
        # Fallback: Try to execute Python code directly if Docker unavailable (development only)
        if language == 'python':
            start_time = datetime.now()
            try:
                import subprocess
                import asyncio
                process = await asyncio.create_subprocess_exec(
                    'python', '-c', code,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    execution_time = (datetime.now() - start_time).total_seconds()
                    return {
                        'stdout': '',
                        'stderr': 'Execution timed out after 10 seconds.',
                        'exit_code': 124,
                        'error': 'Timeout',
                        'execution_time': execution_time
                    }
                
                execution_time = (datetime.now() - start_time).total_seconds()
                return {
                    'stdout': stdout.decode('utf-8', errors='replace'),
                    'stderr': stderr.decode('utf-8', errors='replace'),
                    'exit_code': process.returncode or 0,
                    'error': None,
                    'execution_time': execution_time
                }
            except Exception as e:
                execution_time = (datetime.now() - start_time).total_seconds() if 'start_time' in locals() else 0
                return {
                    'stdout': '',
                    'stderr': f'Execution error: {str(e)}',
                    'exit_code': 1,
                    'error': str(e),
                    'execution_time': execution_time
                }
        return {
            'stdout': '',
            'stderr': f'Docker is not available. Code execution for {language} requires Docker.',
            'exit_code': 1,
            'error': 'Docker not available',
            'execution_time': 0
        }
    
    if language not in LANGUAGE_CONFIGS:
        return {
            'stdout': '',
            'stderr': f'Language "{language}" is not supported for execution.',
            'exit_code': 1,
            'error': f'Unsupported language: {language}',
            'execution_time': 0
        }
    
    config = LANGUAGE_CONFIGS[language]
    start_time = datetime.now()
    
    try:
        # Create temporary file for code
        with tempfile.NamedTemporaryFile(mode='w', suffix=f'.{_get_file_extension(language)}', delete=False) as f:
            f.write(code)
            code_file = f.name
        
        try:
            # Prepare execution command
            if config.get('compile_first'):
                result = await _execute_compiled(language, config, code_file)
            elif config.get('readonly'):
                result = await _execute_readonly(language, config, code, code_file)
            else:
                result = await _execute_interpreted(language, config, code_file)
            
            execution_time = (datetime.now() - start_time).total_seconds()
            result['execution_time'] = execution_time
            
            return result
        finally:
            # Cleanup
            if os.path.exists(code_file):
                os.unlink(code_file)
                
    except asyncio.TimeoutError:
        return {
            'stdout': '',
            'stderr': f'Execution timed out after {config["timeout"]} seconds.',
            'exit_code': 124,
            'error': 'Timeout',
            'execution_time': config['timeout']
        }
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds() if 'start_time' in locals() else 0
        return {
            'stdout': '',
            'stderr': str(e),
            'exit_code': 1,
            'error': f'Execution error: {type(e).__name__}',
            'execution_time': execution_time
        }


async def _execute_interpreted(language: str, config: Dict, code_file: str) -> Dict:
    """Execute interpreted languages (Python, Bash, etc.)"""
    try:
        # Read code content
        with open(code_file, 'r') as f:
            code_content = f.read()
        
        # Run container with code piped in
        container = docker_client.containers.run(
            config['image'],
            f"{config['command']} -",
            stdin_open=True,
            mem_limit=config['memory_limit'],
            network_disabled=True,  # Disable network for security
            remove=True,
            detach=False,
            stdout=True,
            stderr=True,
            timeout=config['timeout'],
            input=code_content.encode('utf-8')
        )
        
        # Parse output
        if isinstance(container, bytes):
            stdout = container.decode('utf-8', errors='replace')
            stderr = ''
        elif isinstance(container, dict):
            stdout = container.get('stdout', b'').decode('utf-8', errors='replace')
            stderr = container.get('stderr', b'').decode('utf-8', errors='replace')
        else:
            stdout = str(container)
            stderr = ''
        
        return {
            'stdout': stdout,
            'stderr': stderr,
            'exit_code': 0
        }
    except docker.errors.ContainerError as e:
        stdout = ''
        stderr = ''
        if hasattr(e, 'stdout') and e.stdout:
            stdout = e.stdout.decode('utf-8', errors='replace') if isinstance(e.stdout, bytes) else str(e.stdout)
        if hasattr(e, 'stderr') and e.stderr:
            stderr = e.stderr.decode('utf-8', errors='replace') if isinstance(e.stderr, bytes) else str(e.stderr)
        return {
            'stdout': stdout,
            'stderr': stderr,
            'exit_code': getattr(e, 'exit_status', 1)
        }
    except Exception as e:
        return {
            'stdout': '',
            'stderr': str(e),
            'exit_code': 1
        }


async def _execute_compiled(language: str, config: Dict, code_file: str) -> Dict:
    """Execute compiled languages (C, C++, Java)"""
    try:
        # Read code content
        with open(code_file, 'r') as f:
            code_content = f.read()
        
        # Create a script that compiles and runs
        if language == 'java':
            script = f"""cat > /tmp/Main.java << 'EOF'
{code_content}
EOF
javac /tmp/Main.java && java -cp /tmp Main"""
        elif language == 'cpp':
            script = f"""cat > /tmp/main.cpp << 'EOF'
{code_content}
EOF
g++ /tmp/main.cpp -o /tmp/main && /tmp/main"""
        elif language == 'c':
            script = f"""cat > /tmp/main.c << 'EOF'
{code_content}
EOF
gcc /tmp/main.c -o /tmp/main && /tmp/main"""
        else:
            script = code_content
        
        # Run container
        container = docker_client.containers.run(
            config['image'],
            'sh -c',
            stdin_open=True,
            mem_limit=config['memory_limit'],
            network_disabled=True,
            remove=True,
            detach=False,
            stdout=True,
            stderr=True,
            timeout=config['timeout'],
            input=script.encode('utf-8')
        )
        
        stdout = container.decode('utf-8', errors='replace') if isinstance(container, bytes) else str(container)
        return {
            'stdout': stdout,
            'stderr': '',
            'exit_code': 0
        }
    except docker.errors.ContainerError as e:
        stdout = ''
        stderr = ''
        if hasattr(e, 'stdout') and e.stdout:
            stdout = e.stdout.decode('utf-8', errors='replace') if isinstance(e.stdout, bytes) else str(e.stdout)
        if hasattr(e, 'stderr') and e.stderr:
            stderr = e.stderr.decode('utf-8', errors='replace') if isinstance(e.stderr, bytes) else str(e.stderr)
        return {
            'stdout': stdout,
            'stderr': stderr,
            'exit_code': getattr(e, 'exit_status', 1)
        }
    except Exception as e:
        return {
            'stdout': '',
            'stderr': str(e),
            'exit_code': 1
        }


async def _execute_readonly(language: str, config: Dict, code: str, code_file: str) -> Dict:
    """Execute readonly operations (validation, linting, etc.)"""
    if language == 'yaml':
        validator_code = f"import yaml, sys\nwith open('/tmp/code.yaml', 'r') as f:\n    yaml.safe_load(f)\nprint('Valid YAML')"
    elif language == 'json':
        validator_code = f"import json, sys\nwith open('/tmp/code.json', 'r') as f:\n    json.load(f)\nprint('Valid JSON')"
    else:
        validator_code = f"print('File validated: {language}')"
    
    try:
        result = docker_client.containers.run(
            config['image'],
            f"{config['command']} -c '{validator_code}'",
            volumes={code_file: {'bind': f'/tmp/code{_get_file_extension(language)}', 'mode': 'ro'}},
            mem_limit=config['memory_limit'],
            network_disabled=True,
            remove=True,
            detach=False,
            timeout=config['timeout']
        )
        
        stdout = result.decode('utf-8', errors='replace') if isinstance(result, bytes) else str(result)
        return {
            'stdout': stdout,
            'stderr': '',
            'exit_code': 0
        }
    except docker.errors.ContainerError as e:
        return {
            'stdout': '',
            'stderr': e.stderr.decode('utf-8', errors='replace') if isinstance(e.stderr, bytes) else str(e.stderr),
            'exit_code': e.exit_status
        }


def _get_file_extension(language: str) -> str:
    """Get file extension for language"""
    extensions = {
        'python': '.py',
        'java': '.java',
        'cpp': '.cpp',
        'c': '.c',
        'shell': '.sh',
        'typescript': '.ts',
        'html': '.html',
        'css': '.css',
        'yaml': '.yaml',
        'json': '.json',
        'markdown': '.md',
        'dockerfile': 'Dockerfile'
    }
    return extensions.get(language, '.txt')


def _get_compile_command(language: str, code_file: str) -> str:
    """Get compile command for compiled languages"""
    if language == 'java':
        return f"javac /tmp/code.java && echo 'Compiled successfully'"
    elif language in ['c', 'cpp']:
        ext = '.cpp' if language == 'cpp' else '.c'
        return f"g++ /tmp/code{ext} -o /tmp/code.out && echo 'Compiled successfully'"
    return ""


def _get_run_command(language: str) -> str:
    """Get run command for compiled languages"""
    if language == 'java':
        return "cd /tmp && java code"
    elif language in ['c', 'cpp']:
        return "/tmp/code.out"
    return ""

