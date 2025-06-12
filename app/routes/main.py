import os
import uuid
import re
from flask import Blueprint, request, send_file, render_template, jsonify
from werkzeug.utils import secure_filename
from app.config.config import Config
from app.models.session import SessionManager
from app.utils import transform
from app.utils.infer import infer
from app.utils.utils import slice_midi

main = Blueprint('main', __name__)
session_manager = SessionManager()

def contains_chinese(text):
    """
    检查文本是否包含中文字符
    """
    pattern = re.compile(r'[\u4e00-\u9fa5]')
    match = pattern.search(text)
    return match is not None

@main.route('/')
def startup():
    return render_template('startup.html')

@main.route('/app')
def main_app():
    return render_template('index.html')

@main.route('/MidiEditor')
def index2():
    return render_template('MidiEditor.html')

@main.route('/performance')
def performance():
    return render_template('performance.html')

@main.route('/about')
def about():
    return render_template('about.html')

@main.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件部分'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    # 获取左手文件参数（可选）
    left_hand_file = request.files.get('left_hand_file')
    has_left_hand_file = left_hand_file and left_hand_file.filename != ''
    
    # 获取时间区间参数（可选）
    start_time = request.form.get('start_time')
    end_time = request.form.get('end_time')
    has_time_interval = start_time and end_time
    
    # 获取target_len参数（可选，默认800）
    target_len = request.form.get('target_len', '800')
    try:
        target_len = int(target_len)
        # 限制target_len范围
        if target_len < 100:
            target_len = 100
        elif target_len > 4000:
            target_len = 4000
    except (ValueError, TypeError):
        target_len = 800
    
    # 检查文件名是否包含中文
    if contains_chinese(file.filename):
        return jsonify({'error': '文件名不能包含中文'}), 400
    
    # 如果有左手文件，也检查左手文件名
    if has_left_hand_file and contains_chinese(left_hand_file.filename):
        return jsonify({'error': '左手文件名不能包含中文'}), 400
    
    # 验证左手文件格式
    if has_left_hand_file and not (left_hand_file.filename.endswith('.mid') or left_hand_file.filename.endswith('.midi')):
        return jsonify({'error': '左手文件必须是MIDI格式'}), 400
    
    if file and file.filename.endswith('.mid'):
        # 生成会话ID并保存文件
        session_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        input_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_{filename}")
        output_midi_path = os.path.join(Config.OUTPUT_FOLDER, f"{session_id}_output.mid")
        output_pdf_path = os.path.join(Config.OUTPUT_FOLDER, f"{session_id}_output.pdf")
        
        # 左手文件路径（如果有的话）
        left_input_path = None
        if has_left_hand_file:
            left_hand_filename = secure_filename(left_hand_file.filename)
            left_input_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_left_{left_hand_filename}")
        
        try:
            file.save(input_path)
            
            # 保存左手文件（如果有的话）
            if has_left_hand_file:
                left_hand_file.save(left_input_path)
            
            # 如果指定了时间区间，先截取文件
            process_input_path = input_path
            if has_time_interval:
                sliced_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_sliced.mid")
                slice_midi(input_path, sliced_path, start_time, end_time)
                process_input_path = sliced_path
            
            # 处理MIDI文件
            print(f"开始处理MIDI文件: {process_input_path}，目标生成序列长度: {target_len}")
            if has_left_hand_file:
                print(f"使用左手伴奏文件: {left_input_path}")
            if not infer(right_input_path=process_input_path, output_path=output_midi_path, left_input_path=left_input_path,target_len=target_len):
                # 清理已上传的文件
                if os.path.exists(input_path):
                    os.remove(input_path)
                if has_left_hand_file and os.path.exists(left_input_path):
                    os.remove(left_input_path)
                if has_time_interval and os.path.exists(process_input_path):
                    os.remove(process_input_path)
                return jsonify({'error': 'MIDI处理失败，可能是文件格式不正确或模型加载失败'}), 500
                
            # 验证输出文件是否创建成功
            if not os.path.exists(output_midi_path):
                if os.path.exists(input_path):
                    os.remove(input_path)
                if has_left_hand_file and os.path.exists(left_input_path):
                    os.remove(left_input_path)
                if has_time_interval and os.path.exists(process_input_path):
                    os.remove(process_input_path)
                return jsonify({'error': 'MIDI处理失败，输出文件未生成'}), 500
                
            # 直接生成PDF
            print(f"开始生成PDF: {output_pdf_path}")
            if not transform.export_pdf(output_midi_path, output_pdf_path):
                return jsonify({'error': 'PDF生成失败，请检查MuseScore是否正确安装'}), 500
                
        except Exception as e:
            print(f"文件处理过程中发生错误: {str(e)}")
            # 清理可能的临时文件
            for temp_file in [input_path, output_midi_path, output_pdf_path]:
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except:
                        pass
            if has_left_hand_file and os.path.exists(left_input_path):
                try:
                    os.remove(left_input_path)
                except:
                    pass
            if has_time_interval and os.path.exists(process_input_path):
                try:
                    os.remove(process_input_path)
                except:
                    pass
            return jsonify({'error': f'文件处理失败: {str(e)}'}), 500
        
        # 保存会话数据
        session_data = {
            'original_filename': filename,
            'input_path': input_path,
            'output_midi_path': output_midi_path,
            'output_pdf_path': output_pdf_path
        }
        
        # 如果有左手文件，保存相关信息
        if has_left_hand_file:
            session_data['left_input_path'] = left_input_path
            session_data['left_hand_filename'] = left_hand_filename
        
        # 如果有时间区间，保存相关信息
        if has_time_interval:
            session_data['sliced_path'] = process_input_path
            session_data['start_time'] = start_time
            session_data['end_time'] = end_time
            if has_left_hand_file:
                message = f'左手伴奏生成成功（使用左手伴奏文件，时间区间：{start_time}-{end_time}，目标生成序列长度：{target_len}）'
            else:
                message = f'左手伴奏生成成功（时间区间：{start_time}-{end_time}，目标生成序列长度：{target_len}）'
        else:
            if has_left_hand_file:
                message = f'左手伴奏生成成功（使用左手伴奏文件，目标生成序列长度：{target_len}）'
            else:
                message = f'左手伴奏生成成功（目标生成序列长度：{target_len}）'
        
        # 保存target_len到会话数据
        session_data['target_len'] = target_len
            
        session_manager.create_session(session_id, session_data)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': message,
            'converted_midi_name': f"converted_{filename}",
            'converted_pdf_name': filename.replace('.mid', '.pdf')
        })
    
    return jsonify({'error': '只支持MIDI文件格式'}), 400

@main.route('/auto-process-midi', methods=['POST'])
def auto_process_midi():
    """
    自动处理拖拽的MIDI文件，不保存到会话，直接返回处理后的MIDI文件流
    """
    if 'file' not in request.files:
        return jsonify({'error': '没有文件部分'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    # 检查文件名是否包含中文
    if contains_chinese(file.filename):
        return jsonify({'error': '文件名不能包含中文'}), 400
    
    if file and (file.filename.endswith('.mid') or file.filename.endswith('.midi')):
        # 生成临时ID和文件路径
        temp_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        temp_input_path = os.path.join(Config.UPLOAD_FOLDER, f"temp_{temp_id}_{filename}")
        temp_output_path = os.path.join(Config.OUTPUT_FOLDER, f"temp_{temp_id}_processed.mid")
        
        try:
            # 保存临时文件
            file.save(temp_input_path)
            
            # 处理MIDI文件
            if not transform.split_midi(temp_input_path, temp_output_path):
                return jsonify({'error': 'MIDI处理失败'}), 500
            
            # 检查处理后的文件是否存在
            if not os.path.exists(temp_output_path):
                return jsonify({'error': '处理后的MIDI文件不存在'}), 500
            
            # 读取处理后的文件内容到内存中
            with open(temp_output_path, 'rb') as f:
                midi_content = f.read()
            
            # 创建一个BytesIO对象
            from io import BytesIO
            midi_buffer = BytesIO(midi_content)
            midi_buffer.seek(0)
                
            # 返回处理后的MIDI文件
            response = send_file(midi_buffer, 
                               mimetype='audio/midi',
                               as_attachment=False,
                               download_name=f"processed_{filename}")
            
            return response
                           
        except Exception as e:
            print(f"自动处理MIDI文件时发生错误: {str(e)}")
            return jsonify({'error': f'处理失败: {str(e)}'}), 500
        finally:
            # 清理临时文件
            try:
                if os.path.exists(temp_input_path):
                    os.remove(temp_input_path)
                if os.path.exists(temp_output_path):
                    os.remove(temp_output_path)
            except:
                pass  # 忽略清理错误
    
    return jsonify({'error': '只支持MIDI文件格式'}), 400

@main.route('/convert-to-pdf/<session_id>', methods=['GET'])
def convert_to_pdf(session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 使用转换后的MIDI文件而不是原始文件
    input_path = session['output_midi_path']
    output_pdf_path = session['output_pdf_path']
    
    # 调用transform.py的PDF转换函数
    success = transform.export_pdf(input_path, output_pdf_path)
    
    if success:
        return jsonify({
            'success': True,
            'message': 'PDF已生成'
        })
    else:
        return jsonify({
            'success': False,
            'error': 'PDF生成失败'
        }), 500

@main.route('/download/<file_type>/<session_id>', methods=['GET'])
def download_file(file_type, session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    if file_type == 'midi':
        file_path = session['output_midi_path']
        return send_file(file_path, as_attachment=True, download_name=f"converted_{session['original_filename']}")
    elif file_type == 'pdf':
        file_path = session['output_pdf_path']
        return send_file(file_path, as_attachment=True, download_name=f"{session['original_filename'].replace('.mid', '.pdf')}")
    else:
        return jsonify({'error': '未知文件类型'}), 400

@main.route('/session/<session_id>', methods=['GET'])
def get_session(session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'exists': False})
    
    return jsonify({
        'exists': True,
        'filename': session['original_filename'],
        'converted_midi_name': f"converted_{session['original_filename']}",
        'converted_pdf_name': session['original_filename'].replace('.mid', '.pdf')
    })

@main.route('/view-pdf/<session_id>', methods=['GET'])
def view_pdf(session_id):
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    file_path = session['output_pdf_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'PDF文件不存在'}), 404
        
    return send_file(file_path, mimetype='application/pdf')

@main.route('/export-original-pdf/<session_id>', methods=['GET'])
def export_original_pdf(session_id):
    """
    导出原始MIDI文件的PDF（如果有时间截取则生成截取后的PDF，否则生成完整的PDF）
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 如果存在截取的文件，使用截取的文件，否则使用原始文件
    if 'sliced_path' in session and os.path.exists(session['sliced_path']):
        input_path = session['sliced_path']
    else:
        input_path = session['input_path']
        
    original_pdf_path = os.path.join(Config.OUTPUT_FOLDER, f"original_{session_id}.pdf")
    
    # 调用transform.py的PDF转换函数处理MIDI文件
    success = transform.export_pdf(input_path, original_pdf_path)
    
    if success:
        # 将原始PDF路径添加到会话数据中
        session['original_pdf_path'] = original_pdf_path
        session_manager.create_session(session_id, session)
        
        return jsonify({
            'success': True,
            'message': '乐谱已成功生成'
        })
    else:
        return jsonify({
            'success': False,
            'error': '原始MIDI的PDF生成失败'
        }), 500

@main.route('/view-original-pdf/<session_id>', methods=['GET'])
def view_original_pdf(session_id):
    """
    查看原始MIDI文件的PDF
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 如果原始PDF路径不存在，先生成
    if 'original_pdf_path' not in session:
        return jsonify({'error': '请先生成原始MIDI的PDF'}), 400
    
    file_path = session['original_pdf_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': '原始MIDI的PDF文件不存在'}), 404
        
    return send_file(file_path, mimetype='application/pdf')

@main.route('/download-original-pdf/<session_id>', methods=['GET'])
def download_original_pdf(session_id):
    """
    下载原始MIDI文件的PDF
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 如果原始PDF路径不存在，先生成
    if 'original_pdf_path' not in session:
        return jsonify({'error': '请先生成原始MIDI的PDF'}), 400
    
    file_path = session['original_pdf_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': '原始MIDI的PDF文件不存在'}), 404
        
    return send_file(file_path, as_attachment=True, 
                    download_name=f"original_{session['original_filename'].replace('.mid', '.pdf')}")

@main.route('/download/original-midi/<session_id>', methods=['GET'])
def download_original_midi(session_id):
    """
    获取原始MIDI文件（如果有时间截取则返回截取后的，否则返回完整的）
    """
    session = session_manager.get_session(session_id)
    if not session:
        return jsonify({'error': '会话不存在'}), 404
    
    # 如果存在截取的文件，返回截取的文件，否则返回原始文件
    if 'sliced_path' in session and os.path.exists(session['sliced_path']):
        file_path = session['sliced_path']
    else:
        file_path = session['input_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': '原始MIDI文件不存在'}), 404
        
    return send_file(file_path, mimetype='audio/midi')

@main.route('/upload-with-time-interval', methods=['POST'])
def upload_with_time_interval():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件部分'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    # 获取时间区间参数
    start_time = request.form.get('start_time')
    end_time = request.form.get('end_time')
    
    if not start_time or not end_time:
        return jsonify({'error': '请提供开始时间和结束时间'}), 400
    
    # 检查文件名是否包含中文
    if contains_chinese(file.filename):
        return jsonify({'error': '文件名不能包含中文'}), 400
    
    if file and file.filename.endswith('.mid'):
        # 生成会话ID并保存文件
        session_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        input_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_{filename}")
        sliced_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_sliced.mid")
        output_midi_path = os.path.join(Config.OUTPUT_FOLDER, f"{session_id}_output.mid")
        output_pdf_path = os.path.join(Config.OUTPUT_FOLDER, f"{session_id}_output.pdf")
        
        file.save(input_path)
        
        try:
            # 先截取时间区间
            slice_midi(input_path, sliced_path, start_time, end_time)
            
            # 然后处理截取后的MIDI文件
            if not transform.split_midi(sliced_path, output_midi_path):
                return jsonify({'error': 'MIDI处理失败'}), 500
                
            # 直接生成PDF
            if not transform.export_pdf(output_midi_path, output_pdf_path):
                return jsonify({'error': 'PDF生成失败'}), 500
            
            # 保存会话数据
            session_data = {
                'original_filename': filename,
                'input_path': input_path,
                'sliced_path': sliced_path,
                'output_midi_path': output_midi_path,
                'output_pdf_path': output_pdf_path,
                'start_time': start_time,
                'end_time': end_time
            }
            session_manager.create_session(session_id, session_data)
            
            return jsonify({
                'success': True,
                'session_id': session_id,
                'message': f'左手伴奏生成成功（时间区间：{start_time}-{end_time}）',
                'converted_midi_name': f"converted_{filename}",
                'converted_pdf_name': filename.replace('.mid', '.pdf')
            })
            
        except ValueError as e:
            return jsonify({'error': f'时间区间处理错误：{str(e)}'}), 400
        except Exception as e:
            return jsonify({'error': f'处理过程中发生错误：{str(e)}'}), 500
    
    return jsonify({'error': '只支持MIDI文件格式'}), 400 