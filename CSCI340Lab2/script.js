$(document).ready(function() {
  var cardName;
  $("#randomCard").click(function(){
    $.ajax({
      dataType: "json",
      jsonCallback: "parseQuote",
      url: "https://db.ygoprodeck.com/api/v7/randomcard.php",
      success: function(results) {
        console.log(results["name"]);
        console.log(results["card_images"][0]["image_url"]);
        cardName = results["name"];
        document.getElementById("cardName").innerHTML = results["name"];
        $('#cardPic').attr("src", results["card_images"][0]["image_url"]).height('300px').width('200px');
      },
      error: function(xhr,status,error) {
        console.log(error);
      },
    })
  })

  $('#getTitle').click(function(){
    var noSpace = cardName.replace(/\s/g, '');
    $.ajax({
      type: "GET",
      dataType: "json",
      jsonCallback: "parseQuote",
      url: `https://cors-anywhere.herokuapp.com/http://api.deezer.com/search?q=${cardName}`,
      success: function(results){
        console.log(results);
        document.getElementById("songTitle").innerHTML = results["data"][0]["title"];
        $('#songMusic').attr("src", results["data"][0]["album"]["cover_medium"]).height('300px').width('300px');
        $('#songPreview').attr("href", results["data"][0]["preview"]);
      },
      error: function(xhr,status,error){
        console.log(error);
        console.log("no song");
      },
    })
  })

  function parseQuote(json) {
  if (!json.Error) {
    $('#resultForm').submit();
  } else {
    $('#loading').hide();
    $('#userForm').show();
    alert(json.Message);
  }
}
})
