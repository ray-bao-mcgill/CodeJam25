"""
Code execution service with Docker sandbox support
Executes code in isolated containers for security
"""
import asyncio
import tempfile
import os
import re
import shutil
from typing import Dict
from datetime import datetime
import docker

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
                return {
                    'stdout': '',
                    'stderr': f'Execution error: {str(e)}',
                    'exit_code': 1,
                    'error': str(e),
                    'execution_time': (datetime.now() - start_time).total_seconds()
                }
        
        elif language == 'java':
            start_time = datetime.now()
            # Extract class name from code
            public_match = re.search(r'public\s+class\s+(\w+)', code)
            class_match = re.search(r'class\s+(\w+)', code)
            class_name = public_match.group(1) if public_match else (class_match.group(1) if class_match else 'Main')
            
            temp_dir = tempfile.mkdtemp()
            java_path = os.path.join(temp_dir, f'{class_name}.java')
            
            try:
                with open(java_path, 'w', encoding='utf-8') as f:
                    f.write(code)
                
                # Compile
                compile_process = await asyncio.create_subprocess_exec(
                    'javac', java_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=temp_dir
                )
                _, compile_stderr = await asyncio.wait_for(compile_process.communicate(), timeout=10)
                
                if compile_process.returncode != 0:
                    return {
                        'stdout': '',
                        'stderr': compile_stderr.decode('utf-8', errors='replace'),
                        'exit_code': compile_process.returncode,
                        'error': 'Java compilation failed',
                        'execution_time': (datetime.now() - start_time).total_seconds()
                    }
                
                # Run
                run_process = await asyncio.create_subprocess_exec(
                    'java', '-cp', temp_dir, class_name,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=temp_dir
                )
                try:
                    stdout, stderr = await asyncio.wait_for(run_process.communicate(), timeout=10)
                except asyncio.TimeoutError:
                    run_process.kill()
                    await run_process.wait()
                    return {
                        'stdout': '',
                        'stderr': 'Execution timed out after 10 seconds.',
                        'exit_code': 124,
                        'error': 'Timeout',
                        'execution_time': (datetime.now() - start_time).total_seconds()
                    }
                
                return {
                    'stdout': stdout.decode('utf-8', errors='replace'),
                    'stderr': stderr.decode('utf-8', errors='replace'),
                    'exit_code': run_process.returncode or 0,
                    'error': None,
                    'execution_time': (datetime.now() - start_time).total_seconds()
                }
            except FileNotFoundError:
                return {
                    'stdout': '',
                    'stderr': 'Java execution requires javac and java. Please install JDK.',
                    'exit_code': 1,
                    'error': 'Java tools not found',
                    'execution_time': (datetime.now() - start_time).total_seconds()
                }
            except Exception as e:
                return {
                    'stdout': '',
                    'stderr': f'Execution error: {str(e)}',
                    'exit_code': 1,
                    'error': str(e),
                    'execution_time': (datetime.now() - start_time).total_seconds()
                }
            finally:
                # Cleanup
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass
        
        elif language == 'typescript':
            start_time = datetime.now()
            # Try ts-node first
            try:
                process = await asyncio.create_subprocess_exec(
                    'ts-node', '-e', code,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    return {
                        'stdout': '',
                        'stderr': 'Execution timed out after 10 seconds.',
                        'exit_code': 124,
                        'error': 'Timeout',
                        'execution_time': (datetime.now() - start_time).total_seconds()
                    }
                
                return {
                    'stdout': stdout.decode('utf-8', errors='replace'),
                    'stderr': stderr.decode('utf-8', errors='replace'),
                    'exit_code': process.returncode or 0,
                    'error': None,
                    'execution_time': (datetime.now() - start_time).total_seconds()
                }
            except FileNotFoundError:
                # Fallback: tsc + node
                with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as f:
                    f.write(code)
                    ts_path = f.name
                
                try:
                    js_path = ts_path.replace('.ts', '.js')
                    
                    # Compile
                    compile_process = await asyncio.create_subprocess_exec(
                        'tsc', ts_path, '--target', 'ES2020', '--module', 'commonjs',
                        '--esModuleInterop', '--skipLibCheck',
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    _, compile_stderr = await asyncio.wait_for(compile_process.communicate(), timeout=5)
                    
                    if compile_process.returncode != 0:
                        return {
                            'stdout': '',
                            'stderr': compile_stderr.decode('utf-8', errors='replace'),
                            'exit_code': compile_process.returncode,
                            'error': 'TypeScript compilation failed',
                            'execution_time': (datetime.now() - start_time).total_seconds()
                        }
                    
                    if not os.path.exists(js_path):
                        return {
                            'stdout': '',
                            'stderr': 'Compiled JavaScript file not found.',
                            'exit_code': 1,
                            'error': 'Compilation output missing',
                            'execution_time': (datetime.now() - start_time).total_seconds()
                        }
                    
                    # Run
                    run_process = await asyncio.create_subprocess_exec(
                        'node', js_path,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    try:
                        stdout, stderr = await asyncio.wait_for(run_process.communicate(), timeout=10)
                    except asyncio.TimeoutError:
                        run_process.kill()
                        await run_process.wait()
                        return {
                            'stdout': '',
                            'stderr': 'Execution timed out after 10 seconds.',
                            'exit_code': 124,
                            'error': 'Timeout',
                            'execution_time': (datetime.now() - start_time).total_seconds()
                        }
                    
                    return {
                        'stdout': stdout.decode('utf-8', errors='replace'),
                        'stderr': stderr.decode('utf-8', errors='replace'),
                        'exit_code': run_process.returncode or 0,
                        'error': None,
                        'execution_time': (datetime.now() - start_time).total_seconds()
                    }
                except FileNotFoundError:
                    return {
                        'stdout': '',
                        'stderr': 'TypeScript execution requires ts-node or tsc+node. Please install: npm install -g ts-node typescript',
                        'exit_code': 1,
                        'error': 'TypeScript tools not found',
                        'execution_time': (datetime.now() - start_time).total_seconds()
                    }
                finally:
                    # Cleanup
                    for path in [ts_path, js_path, ts_path.replace('.ts', '.d.ts')]:
                        try:
                            if os.path.exists(path):
                                os.unlink(path)
                        except:
                            pass
            except Exception as e:
                return {
                    'stdout': '',
                    'stderr': f'Execution error: {str(e)}',
                    'exit_code': 1,
                    'error': str(e),
                    'execution_time': (datetime.now() - start_time).total_seconds()
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
        return {
            'stdout': '',
            'stderr': str(e),
            'exit_code': 1,
            'error': f'Execution error: {type(e).__name__}',
            'execution_time': (datetime.now() - start_time).total_seconds()
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
        
        stdout = container.decode('utf-8', errors='replace') if isinstance(container, bytes) else str(container)
        return {
            'stdout': stdout,
            'stderr': '',
            'exit_code': 0
        }
    except docker.errors.ContainerError as e:
        stdout = e.stdout.decode('utf-8', errors='replace') if hasattr(e, 'stdout') and e.stdout and isinstance(e.stdout, bytes) else (str(e.stdout) if hasattr(e, 'stdout') and e.stdout else '')
        stderr = e.stderr.decode('utf-8', errors='replace') if hasattr(e, 'stderr') and e.stderr and isinstance(e.stderr, bytes) else (str(e.stderr) if hasattr(e, 'stderr') and e.stderr else '')
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
        stdout = e.stdout.decode('utf-8', errors='replace') if hasattr(e, 'stdout') and e.stdout and isinstance(e.stdout, bytes) else (str(e.stdout) if hasattr(e, 'stdout') and e.stdout else '')
        stderr = e.stderr.decode('utf-8', errors='replace') if hasattr(e, 'stderr') and e.stderr and isinstance(e.stderr, bytes) else (str(e.stderr) if hasattr(e, 'stderr') and e.stderr else '')
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
        stderr = e.stderr.decode('utf-8', errors='replace') if hasattr(e, 'stderr') and isinstance(e.stderr, bytes) else (str(e.stderr) if hasattr(e, 'stderr') else str(e))
        return {
            'stdout': '',
            'stderr': stderr,
            'exit_code': getattr(e, 'exit_status', 1)
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

