"""
Code execution service for Python, Java, and JavaScript
Executes code locally (Python/Java) or in browser (JavaScript)
"""
import asyncio
import tempfile
import os
import sys
import re
import shutil
from typing import Dict
from datetime import datetime


async def execute_code(language: str, code: str) -> Dict[str, any]:
    """
    Execute code - supports Python, Java, and JavaScript only
    
    Returns:
        {
            'stdout': str,
            'stderr': str,
            'exit_code': int,
            'error': Optional[str],
            'execution_time': float
        }
    """
    # Only support Python, Java, JavaScript
    if language not in ['python', 'java', 'javascript']:
        return {
            'stdout': '',
            'stderr': f'Run feature not supported for {language} yet. Currently supported: Python, Java, JavaScript.',
            'exit_code': 1,
            'error': f'Language {language} not supported',
            'execution_time': 0
        }
    
    # Execute locally
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
        
    # JavaScript runs in browser, not backend
    elif language == 'javascript':
        return {
            'stdout': '',
            'stderr': 'JavaScript execution should happen in the browser.',
            'exit_code': 1,
            'error': 'JavaScript runs client-side',
            'execution_time': 0
        }
    
    # Should not reach here
    return {
        'stdout': '',
        'stderr': f'Unexpected language: {language}',
        'exit_code': 1,
        'error': 'Internal error',
        'execution_time': 0
    }

