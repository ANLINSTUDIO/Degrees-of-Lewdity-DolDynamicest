import json
import zipfile
from pathlib import Path

def collect_images(photo_dir, base_dir):
    """递归收集 img/photo 目录下所有文件的相对路径（相对于 base_dir）"""
    img_files = []
    photo_path = Path(photo_dir)
    base_path = Path(base_dir)
    
    if not photo_path.exists():
        print(f"警告: {photo_dir} 目录不存在")
        return img_files
    
    for file_path in photo_path.rglob('*'):
        if file_path.is_file():
            # 获取相对于 base_dir 的相对路径，并使用正斜杠
            relative_path = file_path.relative_to(base_path)
            rel_path = str(relative_path).replace('\\', '/')
            img_files.append(rel_path)
            print(f"已添加图片: {relative_path}")
    
    # 排序以保持一致性
    img_files.sort()
    return img_files

def update_boot_json(boot_json_path, img_files):
    """更新 boot.json 中的 imgFileList"""
    try:
        with open(boot_json_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 替换 imgFileList
        config['imgFileList'] = img_files
        
        # 写回文件，保持格式
        with open(boot_json_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
        
        print(f"已更新boot.json ({boot_json_path})，共 {len(img_files)} 个图片文件")
        return config
    except Exception as e:
        print(f"更新 boot.json 失败: {e}")
        raise

def create_zip(zip_name, base_dir):
    """
    将 base_dir 目录下的所有内容打包为 ZIP，保持目录结构。

    Args:
        zip_name (str): 生成的 ZIP 文件名
        base_dir (str): 要打包的根目录
    """
    base_path = Path(base_dir)
    if not base_path.exists() or not base_path.is_dir():
        print(f"错误: 基准目录不存在或不是目录 - {base_dir}")
        return

    try:
        with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 递归遍历 base_dir 下的所有文件
            for file_path in base_path.rglob('*'):
                if file_path.is_file():
                    # 计算相对于 base_dir 的路径，并统一使用正斜杠
                    arcname = str(file_path.relative_to(base_path)).replace('\\', '/')
                    zipf.write(file_path, arcname)
                    print(f"已添加: {arcname}")

        print(f"\n打包完成: {zip_name}")

    except Exception as e:
        print(f"打包 ZIP 失败: {e}")
        raise

def main():
    # 设置路径（假设脚本与这些文件在同一目录）
    base_dir = Path(__file__).parent / "Source"
    boot_json_path = base_dir / "boot.json"
    img_dir = base_dir / "img"
    
    # 1. 收集图片文件（使用相对路径）
    img_files = collect_images(img_dir, base_dir)
    
    # 2. 更新 boot.json
    config = update_boot_json(boot_json_path, img_files)

    print("="*50)
    # 3. 获取版本号用于 ZIP 文件名
    version = config.get('version', 'unknown')
    zip_name = f"Dynamicest-{version}-DolMod.zip"
    print("version: ", version)
    print("filenam: ", zip_name)
    print("开始打包")
    print("="*50)

    # 4. 打包文件
    create_zip(zip_name, base_dir)
    
    print("\n完成！")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("="*50)
        import traceback
        traceback.print_exc()
    input()
