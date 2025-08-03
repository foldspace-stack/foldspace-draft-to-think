#!/bin/bash

directories=("../block-cutter/block-cutter-docs/.obsidian/plugins/foldspace-draft-to-think/" "/Volumes/dafengstudio/自媒体视频素材/素材洗稿/0000/.obsidian/plugins/foldspace-draft-to-think/", "../foldspace-stack.github.io/.obsidian/")



for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        echo "存在: $dir copy 插件"
        cp -vrf ./main*   $dir
        cp -vrf ./*.json   $dir
        cp -vrf ./*.css   $dir
        cp -vrf ./main*    $dir
        cp -vrf ./*.json    $dir
        cp -vrf ./*.css    $dir
    else
        echo "不存在: $dir"
    fi
done

echo "========================="

#cp -vrf ./*  /Volumes/dafengstudio/自媒体视频素材/素材洗稿/0000/.obsidian/plugins/foldspace-draft-to-think
